# NEXORA AI — Backend Schema, Application Flow & Implementation Plan

**Project:** Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management  
**Prototype platform:** Supabase + Rust + Python + React  
**Purpose:** SIH prototype with a clean path to government/PSU production

---
# 0. Locked MVP Decisions

These decisions are final for the SIH MVP. They are binding across the PRD, TRD, and this document, and should not be re-opened during implementation without an explicit scope change.

```text
1. Storage      → Supabase Storage only. SeaweedFS/other S3-compatible stores are a
                   future migration option, not part of the MVP build.

2. Queue        → RabbitMQ is required infrastructure for the MVP, not a later/optional
                   item. Minimum queue set: ai_processing_queue, ai_result_queue,
                   a retry mechanism, and a dead-letter queue (see Section 9A).

3. Service comm → REST/JSON only between Rust and Python for the MVP. gRPC/Tonic/Prost
                   is a documented future option and must not be built now.

4. DB names     → work_observations, match_proposals, actual_events, approvals,
                   audit_events (as defined in Section 4 onward). Do not create
                   event_observations, event_matches, or event_approvals.

5. Event status → lifecycle_status: PROPOSED → MATCHED → REVIEW_REQUIRED → APPROVED →
                   COMMITTED (failure path: REJECTED). verification_status: UNVERIFIED,
                   SYSTEM_VERIFIED (automatic decision), HUMAN_VERIFIED (planner
                   approval). AUTO_ACCEPTED is not a valid status anywhere.

6. Auth/RLS     → Rust validates identity/role and enforces business authorization.
                   Supabase RLS is an additional database-level protection layer, not
                   the primary authorization mechanism. project_members.user_id is the
                   Supabase Auth user id (see Section 3A).

7. Embedding    → sentence-transformers/all-MiniLM-L6-v2 (384-dim output), matching the
                   activities.embedding VECTOR(384) column (see Section 6A). Any change
                   to this model requires a matching migration of the column dimension.

8. MVP flow     → One authoritative flow (Section 23) governs the whole build. All other
                   flow diagrams in these documents are illustrations of this same flow,
                   not alternatives to it.
```

---
# 1. Backend Architecture

```text
                                USERS
                                  |
                                  v
                         React / TypeScript
                                  |
                                  v
                           Rust / Axum API
                                  |
               +------------------+------------------+
               |                  |                  |
               v                  v                  v
          Supabase Auth      Supabase Postgres     Object Storage
               |             + pgvector            |
               |                  |                 |
               |                  |                 +-- reports
               |                  |                 +-- spreadsheets
               |                  |                 +-- images
               |                  |                 +-- audio
               |                  |
               |                  v
               |             Business Data
               |                  |
               |          +-------+--------+
               |          |                |
               |          v                v
               |      Actual Events     Audit Events
               |
               v
       Project/User Authorization

                              |
                              | REST / JSON (MVP)
                              v
                       Python / FastAPI
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
         Extraction       Embeddings        Matching
             |                |                |
             v                v                v
          OCR/ASR         pgvector         Match Proposal
                                                |
                                                v
                                           Rust Trust Layer
                                                |
                                      +---------+---------+
                                      |                   |
                                      v                   v
                                Auto-Link            Human Review
                                      |                   |
                                      +---------+---------+
                                                |
                                                v
                                          Event Ledger
                                                |
                                                v
                                        Schedule Projection
                                                |
                                                v
                                         PMIS / Export
```

---
# 2. Technology Decisions

## Backend

```text
Rust
Axum
Tokio
Tower
Serde
SQLx
Tracing
```

MVP service-to-service communication (Rust ↔ Python) is REST/JSON. Tonic/Prost (gRPC) is a future, post-MVP option for internal RPC and must not be built now.

## AI

```text
Python
FastAPI
Pydantic v2
Polars
Pandas
PyMuPDF
openpyxl
spaCy
RapidFuzz
sentence-transformers
OCR
ASR
LLM Gateway
```

## Backend platform

```text
Supabase
├── PostgreSQL
├── pgvector
├── Supabase Auth
└── Supabase Storage
```

## Prototype cache

```text
Redis
```

Redis is optional during the first MVP and must remain non-authoritative.

---
# 3. Supabase Role in the Prototype

Supabase will provide:

```text
PostgreSQL
pgvector
Authentication
Row Level Security
Object Storage
```

The Rust backend remains the business/domain layer.

### Important rule

Do not put important business logic only inside the Supabase client.

Use:

```text
React
  ↓
Rust API
  ↓
Supabase/PostgreSQL
```

The browser should not directly perform sensitive schedule mutations.

Supabase Auth can issue identity tokens, which Rust validates before applying authorization and business rules.

---
# 3A. Locked Auth/RLS Boundary

This boundary is final for the MVP:

```text
Supabase Auth
    → issues the identity token (who the user is)

Rust
    → validates the token
    → is the SOLE enforcer of role/business authorization
      (what the user is allowed to do)

Supabase RLS
    → an additional database-level protection layer
    → not the primary authorization mechanism
    → protects against direct/misconfigured DB access, it does not replace
      Rust's authorization checks
```

`project_members.user_id` **is** the Supabase Auth user id — there is no separate application-level user table. Every row in `project_members` corresponds 1:1 to a Supabase Auth identity, and RLS policies on project-scoped tables should join through `project_members.user_id = auth.uid()`.

Rust must never rely on RLS as its only authorization check for a business operation; RLS is defense-in-depth, and Rust must independently authorize every command.

---
# 4. Database Schema

## 4.1 projects

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    client_name TEXT,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4.2 project_members

```sql
CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    user_id UUID NOT NULL,
    role TEXT NOT NULL,
    discipline TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, user_id)
);
```

Roles:

```text
ADMIN
PROJECT_MANAGER
PLANNER
DISCIPLINE_ENGINEER
SUPERVISOR
AUDITOR
KNOWLEDGE_MANAGER
```

---

## 4.3 schedule_versions

```sql
CREATE TABLE schedule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    version_name TEXT NOT NULL,
    source_system TEXT,
    source_file_id UUID,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    checksum TEXT
);
```

Purpose:

```text
Schedule V1
Schedule V2
Schedule V3
```

Historical events retain the schedule context under which they were interpreted.

---
# 5. WBS Schema

## 5.1 wbs_nodes

```sql
CREATE TABLE wbs_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(id),
    parent_id UUID REFERENCES wbs_nodes(id),
    level INTEGER NOT NULL,
    wbs_code TEXT NOT NULL,
    name TEXT NOT NULL
);
```

Supports:

```text
L1
L2
L3
L4
L5
L6
```

---
# 6. Activity Schema

## 6.1 activities

```sql
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    schedule_version_id UUID NOT NULL REFERENCES schedule_versions(id),
    wbs_node_id UUID REFERENCES wbs_nodes(id),

    activity_code TEXT NOT NULL,
    description TEXT NOT NULL,

    discipline TEXT,
    contractor TEXT,
    location TEXT,

    planned_start TIMESTAMPTZ,
    planned_finish TIMESTAMPTZ,
    planned_duration_hours NUMERIC,

    status TEXT NOT NULL DEFAULT 'PLANNED',

    line_number TEXT,
    equipment_tag TEXT,

    searchable_text TEXT,

    embedding VECTOR(384),

    version INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 6A. Locked Embedding Model

`activities.embedding` and any observation/query embeddings **must** be produced by the same model:

```text
Model:      sentence-transformers/all-MiniLM-L6-v2
Output dim: 384
```

This is locked before any `VECTOR(384)` column is created or populated. If the embedding model is ever changed, `VECTOR(384)` must be migrated to match the new model's output dimension in the same change — the column width and the model are not independent decisions. Store `embedding_model` and `embedding_version` alongside AI output (Section 45) so historical vectors can be identified if the model is ever upgraded.

Recommended unique constraint:

```text
(project_id, schedule_version_id, activity_code)
```

---
# 7. Activity Dependencies

```sql
CREATE TABLE activity_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    predecessor_activity_id UUID NOT NULL REFERENCES activities(id),
    successor_activity_id UUID NOT NULL REFERENCES activities(id),
    dependency_type TEXT NOT NULL,
    lag_hours NUMERIC DEFAULT 0
);
```

Dependency types:

```text
FS
SS
FF
SF
```

---
# 8. Documents

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL REFERENCES projects(id),

    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT,

    storage_bucket TEXT NOT NULL,
    storage_key TEXT NOT NULL,

    checksum_sha256 TEXT,

    source_type TEXT NOT NULL,
    document_type TEXT,

    classification TEXT DEFAULT 'INTERNAL',

    uploaded_by UUID,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    processing_status TEXT NOT NULL DEFAULT 'RECEIVED'
);
```

Source types:

```text
DAILY_REPORT
DISCIPLINE_SPREADSHEET
SITE_DIARY
VOICE
IMAGE
MANUAL
SCHEDULE
```

---
# 9. Document Processing Jobs

```sql
CREATE TABLE document_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),

    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',

    attempt_count INTEGER NOT NULL DEFAULT 0,

    error_code TEXT,
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
```

Job types:

```text
PARSE
OCR
ASR
EXTRACT
NORMALIZE
EMBED
MATCH
```

---
# 9A. RabbitMQ Queue Design (MVP — Required)

RabbitMQ is locked as required infrastructure for the MVP. The basic queue design below must exist before AI-pipeline coding begins.

## Exchange

```text
nexora.jobs (type: direct)
```

## Queues

```text
ai_processing_queue
    binding key: document.process
    consumer:    Python worker (extraction → normalization → embedding → matching)
    published by: Rust, after a document record + document_jobs row is created

ai_result_queue
    binding key: document.result
    consumer:    Rust (creates/updates match_proposals, applies confidence policy)
    published by: Python worker, on successful completion of a job

ai_processing_retry_queue
    TTL: per-message delay (e.g. 30s, 2m, 10m — exponential backoff)
    dead-letter-exchange: nexora.jobs
    dead-letter-routing-key: document.process
    purpose: a message that lands here is re-delivered to ai_processing_queue
             after its TTL expires, up to document_jobs.attempt_count limits

ai_processing_dlq (dead-letter queue)
    binding key: document.failed
    purpose: terminal failures — attempt_count exceeded, or a non-retryable error.
             document_jobs.status is set to FAILED and the document remains
             manually processable; the observation/event is never silently dropped.
```

## Basic retry behavior

```text
Worker picks up ai_processing_queue message
        ↓
Processing fails
        ↓
attempt_count < max_attempts?
   ├── yes → publish to ai_processing_retry_queue (with backoff TTL)
   └── no  → publish to ai_processing_dlq, set document_jobs.status = FAILED
```

## Result flow

```text
Python worker finishes successfully
        ↓
Publishes result to ai_result_queue
        ↓
Rust consumes result
        ↓
Rust creates match_proposals + applies confidence policy
        ↓
document_jobs.status updated (COMPLETED)
```

Each `document_jobs` row tracks `job_type`, `status`, and `attempt_count`, which map directly onto this queue design — the queue is the transport, `document_jobs` is the durable record of what happened.

Message payloads must carry `project_id`, `document_id`, `job_id`, and `correlation_id` so downstream processing stays project-scoped and traceable end-to-end (see Section 44, Observability).

---
# 10. Document Extractions

```sql
CREATE TABLE document_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),

    extraction_version TEXT NOT NULL,

    extracted_text TEXT,

    structured_output JSONB,

    extraction_confidence NUMERIC,

    model_name TEXT,
    model_version TEXT,
    prompt_version TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Raw extracted output is retained for traceability.

---
# 11. Observations

I recommend adding this intermediate entity.

It prevents the system from forcing every field statement directly into one schedule activity.

```sql
CREATE TABLE work_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL REFERENCES projects(id),
    document_id UUID REFERENCES documents(id),

    reported_by UUID,

    observed_at TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    discipline TEXT,
    location TEXT,

    raw_text TEXT,
    normalized_text TEXT,

    event_type TEXT,

    quantity NUMERIC,
    quantity_unit TEXT,
    progress_percent NUMERIC,

    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',

    extraction_confidence NUMERIC
);
```

This supports:

```text
PDF
Excel
Voice
Text
```

all converging into one canonical observation.

---
# 12. Match Proposals

```sql
CREATE TABLE match_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    observation_id UUID NOT NULL REFERENCES work_observations(id),

    activity_id UUID NOT NULL REFERENCES activities(id),

    semantic_score NUMERIC,
    text_score NUMERIC,
    discipline_score NUMERIC,
    location_score NUMERIC,
    tag_score NUMERIC,
    wbs_score NUMERIC,
    temporal_score NUMERIC,

    final_score NUMERIC NOT NULL,

    rank INTEGER NOT NULL,

    reasons JSONB,

    matcher_version TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Example `reasons`:

```json
{
  "discipline": "MATCH",
  "location": "MATCH",
  "line_number": "MATCH",
  "temporal_window": "MATCH"
}
```

---
# 13. Actual Event Ledger

This is the central table.

```sql
CREATE TABLE actual_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL REFERENCES projects(id),

    observation_id UUID REFERENCES work_observations(id),
    activity_id UUID REFERENCES activities(id),

    schedule_version_id UUID REFERENCES schedule_versions(id),

    event_type TEXT NOT NULL,

    event_time TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    temporal_precision TEXT DEFAULT 'EXACT',

    discipline TEXT,
    contractor TEXT,
    location TEXT,

    reported_description TEXT,
    normalized_description TEXT,

    quantity NUMERIC,
    quantity_unit TEXT,
    progress_percent NUMERIC,

    extraction_confidence NUMERIC,
    matching_confidence NUMERIC,

    source_document_id UUID REFERENCES documents(id),

    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',

    lifecycle_status TEXT NOT NULL DEFAULT 'PROPOSED',

    idempotency_key TEXT,

    model_version TEXT,
    matcher_version TEXT,
    schema_version TEXT NOT NULL DEFAULT 'v1',

    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---
# 14. Event Lifecycle

```text
PROPOSED
   ↓
MATCHED
   ↓
REVIEW_REQUIRED ──────┐
   ↓                  |
APPROVED              |
   ↓                  |
COMMITTED <-----------+
```

Failure:

```text
PROPOSED
   ↓
REJECTED
```

`actual_events.lifecycle_status` is constrained to exactly these six values:

```sql
lifecycle_status TEXT NOT NULL DEFAULT 'PROPOSED'
    CHECK (lifecycle_status IN
        ('PROPOSED', 'MATCHED', 'REVIEW_REQUIRED', 'APPROVED', 'COMMITTED', 'REJECTED'))
```

`verification_status` is a separate axis from `lifecycle_status` and is constrained to exactly three values:

```sql
verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (verification_status IN ('UNVERIFIED', 'SYSTEM_VERIFIED', 'HUMAN_VERIFIED'))
```

```text
UNVERIFIED        → no decision has been made yet
SYSTEM_VERIFIED   → confidence policy auto-linked the event (no human involved)
HUMAN_VERIFIED    → a planner reviewed and approved/corrected the event
```

`AUTO_ACCEPTED` is **not** a valid value anywhere in this schema. A high-confidence auto-link is expressed as `lifecycle_status = 'COMMITTED'` (or `'APPROVED'`, pre-commit) combined with `verification_status = 'SYSTEM_VERIFIED'` — never as a status string of its own.

---
# 15. Current Activity State

Do not reconstruct every dashboard request from the entire event history.

Use a projection:

```sql
CREATE TABLE activity_current_state (
    activity_id UUID PRIMARY KEY REFERENCES activities(id),

    status TEXT NOT NULL,

    actual_start TIMESTAMPTZ,
    actual_finish TIMESTAMPTZ,

    progress_percent NUMERIC,

    last_event_id UUID REFERENCES actual_events(id),

    last_event_time TIMESTAMPTZ,

    version INTEGER NOT NULL DEFAULT 1,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The event ledger remains the historical source.

This table is the fast operational state.

---
# 16. Approvals

```sql
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id UUID NOT NULL REFERENCES actual_events(id),

    decision TEXT NOT NULL,

    decided_by UUID NOT NULL,

    reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Decisions:

```text
APPROVED
REJECTED
CORRECTED
```

---
# 17. Audit Events

```sql
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID REFERENCES projects(id),

    actor_id UUID,
    actor_role TEXT,

    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,

    action TEXT NOT NULL,

    old_value JSONB,
    new_value JSONB,

    reason TEXT,

    request_id TEXT,
    correlation_id TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Audit records should be append-oriented and access restricted.

---
# 18. Outbox

For reliable PMIS integration:

```sql
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    aggregate_type TEXT NOT NULL,
    aggregate_id UUID NOT NULL,

    event_type TEXT NOT NULL,

    payload JSONB NOT NULL,

    status TEXT NOT NULL DEFAULT 'PENDING',

    attempt_count INTEGER NOT NULL DEFAULT 0,

    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    processed_at TIMESTAMPTZ,

    last_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Transaction:

```text
PostgreSQL transaction
|
+-- actual_event
+-- state_projection
+-- audit_event
+-- outbox_event
```

All commit together.

---
# 19. Activity Lineage

For schedule revisions:

```sql
CREATE TABLE activity_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source_activity_id UUID NOT NULL REFERENCES activities(id),
    target_activity_id UUID NOT NULL REFERENCES activities(id),

    relation_type TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Relations:

```text
REPLACED_BY
SPLIT_INTO
MERGED_FROM
RENAMED_TO
```

---
# 20. Terminology / Project Glossary

```sql
CREATE TABLE terminology (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL REFERENCES projects(id),

    canonical_term TEXT NOT NULL,

    synonym TEXT NOT NULL,

    discipline TEXT,

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Example:

```text
canonical:
SPOOL_ERECTION

synonyms:
spool erected
spool installed
spool mounted
```

---
# 21. RLS / Supabase Security Model

Enable Row Level Security on project data.

Conceptually:

```text
user
  ↓
project_members
  ↓
project_id
  ↓
authorized records
```

Rules:

```text
Supervisor
→ only projects they belong to

Planner
→ project schedule + approval scope

Auditor
→ read-only audit/evidence

Admin
→ administrative scope
```

The Rust API should enforce authorization as well.

Do not depend solely on frontend visibility.

---
# 31. Matching Engine Design

## Stage 1 — Candidate filtering

```text
project
discipline
location
schedule version
date window
activity status
```

## Stage 2 — Exact identifiers

```text
activity code
line number
equipment tag
WBS
```

## Stage 3 — Fuzzy matching

```text
RapidFuzz
```

## Stage 4 — Semantic matching

```text
sentence-transformers
pgvector
```

## Stage 5 — Rule scoring

```text
discipline
location
WBS
temporal feasibility
```

## Output

```text
MatchProposal
```

not a direct database mutation.

---
# 32. Confidence Policy

```text
score >= 0.90
    ↓
Auto-link

0.70 <= score < 0.90
    ↓
Planner review

score < 0.70
    ↓
Unmatched/new activity review
```

These are starting values and should be tuned using the demo/test dataset.

---
# 33. Retrieval Query

Conceptually:

```sql
SELECT
    id,
    activity_code,
    description,
    discipline,
    location,
    1 - (embedding <=> $query_embedding) AS similarity
FROM activities
WHERE project_id = $project_id
  AND schedule_version_id = $schedule_version_id
  AND discipline = $discipline
ORDER BY embedding <=> $query_embedding
LIMIT 20;
```

Important:

> Project/tenant scoping happens inside the retrieval query.

Never perform a global vector search and filter security afterward.

---
# 34. Rust Domain Validation

Before commit:

```text
Authentication
      ↓
Authorization
      ↓
Schema validation
      ↓
Project ownership
      ↓
Activity exists
      ↓
Schedule version valid
      ↓
Duplicate check
      ↓
State transition valid
      ↓
Temporal validation
      ↓
Approval policy
      ↓
Transaction
```

---
# 35. Activity State Rules

```text
PLANNED
   |
   v
STARTED
   |
   v
IN_PROGRESS
   |
   v
COMPLETED
```

Alternative states:

```text
BLOCKED
DELAYED
CANCELLED
```

Examples:

```text
START after CANCELLED
→ reject

FINISH before START
→ reject

PROGRESS > 100
→ reject unless project policy permits a special interpretation

END on unknown activity
→ reject
```

---
# 36. Current State Projection

When an event is committed:

```text
Actual Event
     ↓
State Projector
     ↓
activity_current_state
```

Example:

```text
START
 ↓
status = STARTED
actual_start = T1
```

then:

```text
END
 ↓
status = COMPLETED
actual_finish = T2
```

Dashboard reads the projection instead of replaying all events.

---
# 37. Caching Design

Use Redis only where it provides measurable benefit.

First candidates:

```text
activity lookup
candidate matches
dashboard aggregates
job status
rate limiting
```

Cache-aside:

```text
Read
 ↓
Redis?
 ├── YES → return
 └── NO
      ↓
PostgreSQL
      ↓
Redis
```

Write:

```text
PostgreSQL commit
      ↓
Invalidate cache
```

---
# 38. Storage Design

Supabase Storage bucket structure:

```text
projects/
  P001/
    raw/
      daily-reports/
      spreadsheets/
      site-diaries/
      images/
      audio/

    processed/
      extracted-text/
      ocr/

    generated/
      reports/
      exports/
```

Use private buckets.

The browser should not have permanent unrestricted storage credentials.

---
# 39. Security Architecture

```text
Browser
  ↓ HTTPS
Rust API
  ↓
Auth validation
  ↓
Project authorization
  ↓
Business validation
  ↓
Supabase
```

Database and storage access should be private/restricted as supported by the deployment environment.

For production, add:

```text
WAF
rate limiting
centralized logs
SIEM
secrets manager
network segmentation
backup/DR
```

---
# 40. Error Handling

Every API should return structured errors.

Example:

```json
{
  "code": "TEMPORAL_CONSTRAINT_VIOLATION",
  "message": "Actual finish cannot precede actual start.",
  "request_id": "req-123"
}
```

Common codes:

```text
UNAUTHORIZED
FORBIDDEN
PROJECT_NOT_FOUND
ACTIVITY_NOT_FOUND
DUPLICATE_EVENT
LOW_CONFIDENCE
CONFLICTING_EVIDENCE
TEMPORAL_CONSTRAINT_VIOLATION
INVALID_STATE_TRANSITION
PROCESSING_FAILED
PMIS_SYNC_FAILED
```

---
# 41. Idempotency

For mutation APIs:

```text
POST /events
Idempotency-Key: EVENT-DEVICE-12345
```

Store the key in PostgreSQL.

If the same request arrives again:

```text
return previous result
```

Do not create a second event.

---
# 42. Concurrency

Activities should include:

```text
version
updated_at
```

Use optimistic locking.

Example:

```text
UPDATE activity_current_state
SET ...
WHERE activity_id = $id
  AND version = $expected_version;
```

If zero rows are affected:

```text
CONCURRENT_MODIFICATION
```

Return a conflict response.

---
# 43. Processing State Machine

Documents/jobs should use:

```text
RECEIVED
   ↓
STORED
   ↓
QUEUED
   ↓
PROCESSING
   ↓
EXTRACTED
   ↓
MATCHED
   ↓
REVIEW_REQUIRED
   ↓
COMPLETED
```

Failures:

```text
FAILED
RETRYING
DEAD_LETTER
```

---
# 44. Observability

Every request receives:

```text
request_id
correlation_id
```

Every event receives:

```text
event_id
```

Every document:

```text
document_id
```

Every async operation:

```text
job_id
```

These IDs should be propagated through:

```text
React
→ Rust
→ RabbitMQ
→ Python
→ Rust
→ PostgreSQL
```

This makes debugging possible.

---
# 45. AI Version Tracking

Persist:

```text
model_name
model_version
prompt_version
embedding_model
embedding_version
matcher_version
schema_version
```

with AI-derived outputs.

This allows later analysis:

```text
Why did the system match this event differently
after a model upgrade?
```

---
