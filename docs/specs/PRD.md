# PRD — NEXORA AI
## Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management

**Version:** 1.0  
**Status:** Prototype PRD  
**Theme:** Smart Automation  
**Target:** Smart India Hackathon (SIH)  
**Primary Users:** Site Supervisors, Discipline Engineers, Planners/Schedulers, Project Managers, Auditors  
**Deployment Goal:** Low-cost SIH prototype with a path to government/PSU deployment

---

# 1. Product Summary

NEXORA AI is an evidence-driven actual-progress intelligence platform that bridges the gap between **field execution** and the **L5/L6 baseline project schedule**.

Infrastructure project schedules are structured in systems such as Primavera P6 or MS Project, but actual execution information arrives through daily progress reports, discipline spreadsheets, site diaries, scanned documents, and verbal supervisor updates. These inputs are fragmented, inconsistent, delayed, and frequently use terminology that differs from the schedule.

NEXORA AI ingests these heterogeneous inputs, extracts activity-level execution events, normalizes field terminology, intelligently maps the events to the correct L5/L6 schedule activity, assigns confidence, preserves the source evidence, and routes uncertain mappings to a planner for review.

The product is intentionally designed so that:

> **AI proposes → Rust validates → Human approves when necessary → PostgreSQL records → Audit proves.**

The AI layer must never directly and autonomously modify the authoritative schedule.

---

# 1A. Locked MVP Decisions

These decisions are final for the SIH MVP and are shared verbatim with the TRD and the Backend Schema/Implementation Plan. They must not be re-opened during implementation without an explicit scope change.

```text
1. Storage      → Supabase Storage only for the MVP. S3-compatible self-hosted storage
                   is a documented future migration option, not a current build target.

2. Queue        → RabbitMQ is required MVP infrastructure, not a later/optional item.
                   Minimum design: an AI-processing queue, a result flow back to Rust,
                   retry behavior, and a dead-letter queue.

3. Service comm → REST/JSON only between Rust and Python for the MVP. gRPC/Tonic/Prost
                   is a future option and must not be built now.

4. DB names     → work_observations, match_proposals, actual_events, approvals,
                   audit_events. Alternate names (event_observations, event_matches,
                   event_approvals) are not used anywhere.

5. Event status → lifecycle_status: PROPOSED → MATCHED → REVIEW_REQUIRED → APPROVED →
                   COMMITTED (failure: REJECTED). verification_status: UNVERIFIED,
                   SYSTEM_VERIFIED (automatic decision), HUMAN_VERIFIED (planner
                   approval). AUTO_ACCEPTED is not a valid status.

6. Auth/RLS     → Rust validates identity/role and enforces business authorization.
                   Supabase RLS is an additional database-level protection layer, not
                   the primary authorization mechanism.

7. Embedding    → sentence-transformers/all-MiniLM-L6-v2 (384-dim), matching the
                   VECTOR(384) schema column.

8. MVP flow     → One authoritative flow (Section 48) governs the whole build. All
                   other journeys/diagrams in this document illustrate that same flow.
```

---

# 2. Problem Statement

## Current situation

Infrastructure project execution occurs across multiple disciplines:

- Civil
- Piping
- Static equipment
- Rotating equipment
- Electrical
- Instrumentation
- HSE
- Contractors/subcontractors

The baseline schedule is typically structured and coded, while actual execution data is reported in unstructured or semi-structured forms.

### Example

Schedule:

```text
Activity ID: PIP-2401
WBS: 3.4.2.1
Description: Erect 24" Line P-101
Location: Rack B
Planned Finish: 27-Aug
```

Field report:

> "Piping team completed erection of the 24 inch line at Rack B."

The human planner must determine that the report corresponds to `PIP-2401`, manually reconcile the actual date, and update the schedule.

At project scale this becomes slow, error-prone, and difficult to audit.

---

# 3. Core Problems

## P1 — Fragmented execution data

Actual progress is distributed across:

- PDFs
- Excel spreadsheets
- text reports
- site diaries
- scanned documents
- verbal updates

## P2 — Terminology mismatch

The field may say:

```text
spool installed
spool erected
spool mounted
```

while the schedule says:

```text
Erect Piping Spool
```

## P3 — Granularity mismatch

One field statement may correspond to multiple schedule activities, while several field observations may contribute to one planned activity.

## P4 — Delayed schedule reconciliation

Actual start/end events may remain disconnected from the schedule until the next formal update cycle.

## P5 — Low-quality analytics

If actual events are incomplete or incorrectly linked, downstream delay analysis, forecasting, productivity analysis, and performance monitoring are unreliable.

## P6 — Loss of institutional knowledge

After project closeout, real durations, bottlenecks, delay causes, and execution patterns remain scattered across reports and individual experience.

## P7 — Trust and governance

An AI system that silently updates an official schedule is unsafe. Every important change needs provenance, confidence, validation, and auditability.

---

# 4. Product Vision

> Build a trusted digital layer that turns messy field execution evidence into structured, traceable, near-real-time project progress intelligence.

Long-term:

```text
Field Reality
    ↓
Evidence
    ↓
Structured Actual Events
    ↓
L5/L6 Schedule Link
    ↓
Verified Project Truth
    ↓
Live Analytics
    ↓
Institutional Memory
    ↓
Better Future Planning
```

---

# 5. Product Goals

## Primary goals

1. Ingest heterogeneous project-execution inputs.
2. Extract activity-level actual start/end/progress events.
3. Normalize discipline-specific terminology.
4. Link field observations to L5/L6 schedule activities.
5. Provide confidence and evidence for every match.
6. Automatically process high-confidence matches.
7. Route ambiguous matches to human planners.
8. Prevent invalid or unauthorized schedule changes.
9. Preserve a complete audit trail.
10. Produce a clean structured actual-progress dataset.
11. Feed real-time analytics and future institutional memory.
12. Demonstrate a deployable, low-cost SIH prototype.

## Secondary goals

- Support voice/text supervisor interaction.
- Support offline-friendly field workflows.
- Provide delay/blocker extraction.
- Provide schedule export.
- Support a migration path to government/PSU environments.

---

# 6. Non-Goals for the SIH MVP

The prototype will not attempt to deliver:

- Full production-grade OCR.
- Full production-grade ASR.
- Full bidirectional Primavera integration.
- Full MS Project integration.
- Kubernetes-based production infrastructure.
- Enterprise-scale high availability.
- Multi-region disaster recovery.
- Autonomous schedule optimization.
- Automatic creation of project baselines.
- Fully autonomous AI schedule updates.
- Model fine-tuning on sensitive live government data.
- Live project data ingestion.

---

# 7. Target Users

## 7.1 Site Supervisor

Needs a fast way to report what happened without filling complex forms.

Typical input:

> "Piping team completed the 24-inch line at Rack B."

## 7.2 Discipline Engineer

Needs to review discipline-specific events and correct incorrect mappings.

## 7.3 Planner / Scheduler

Needs to:

- review low-confidence matches,
- approve or correct mappings,
- inspect evidence,
- manage unmatched activities,
- export/update actual progress.

## 7.4 Project Manager

Needs a high-level view of:

- actual progress,
- schedule variance,
- pending reviews,
- delays,
- discipline performance.

## 7.5 Auditor

Needs to understand:

- who reported an event,
- what source was used,
- what AI extracted,
- why an activity was selected,
- who approved it,
- when the schedule changed.

## 7.6 Knowledge Manager

Needs historical, queryable execution patterns across projects.

---

# 8. Key User Journeys

# Journey A — Daily Report Processing

```text
Planner uploads PDF
        ↓
System stores original evidence
        ↓
Text extraction
        ↓
AI extracts events
        ↓
Events normalized
        ↓
L5/L6 candidates retrieved
        ↓
Hybrid match
        ↓
Confidence score
        ↓
Auto-link / Review / Unmatched
```

---

# Journey B — Supervisor Time Agent

Supervisor says:

> "Started excavation for the pump foundation at Unit 3 at 10 AM."

System:

```text
Event:
START

Discipline:
Civil

Location:
Unit 3

Activity:
Pump foundation excavation

Time:
10:00 AM
```

System searches schedule candidates and asks for confirmation only when required.

---

# Journey C — Ambiguous Match

Input:

> "Pump base work completed."

System finds:

```text
MECH-P101    89%
CIV-P101     86%
```

Because the match is ambiguous:

```text
→ Planner Review
```

Planner sees evidence and chooses the correct activity.

---

# Journey D — Unmatched Activity

Input:

> "Temporary access platform installed at Unit 4."

No suitable L5/L6 activity exists.

System:

```text
UNMATCHED / NEW ACTIVITY CANDIDATE
```

Planner can classify or create the appropriate mapping according to project policy.

The system must never silently discard the event.

---

# Journey E — Conflicting Sources

Supervisor:

```text
Completed 27-Aug
```

Contractor spreadsheet:

```text
Completed 28-Aug
```

System:

```text
CONFLICTING EVIDENCE
```

Planner resolves the conflict.

---

# 9. Functional Requirements

## FR-001 — Project Setup

The system shall allow a project to be configured with:

- project identity,
- discipline list,
- WBS,
- schedule version,
- locations,
- contractors,
- terminology glossary,
- matching thresholds.

---

## FR-002 — Schedule Import

The system shall import a sample L5/L6 schedule from CSV/XLSX for the MVP.

Minimum fields:

```text
project_id
schedule_version
wbs_code
activity_id
activity_description
discipline
location
planned_start
planned_finish
status
```

---

## FR-003 — Document Ingestion

The system shall ingest:

- PDF daily reports,
- discipline spreadsheets,
- plain text,
- optionally scanned PDFs.

---

## FR-004 — Evidence Preservation

Every uploaded source shall have:

```text
document_id
project_id
filename
mime_type
checksum
source_type
uploaded_by
uploaded_at
storage_reference
classification
```

The original file must remain retrievable.

---

## FR-005 — Text Extraction

The system shall:

- extract normal PDF text,
- parse Excel records,
- optionally OCR scanned content,
- produce normalized source text.

---

## FR-006 — Event Extraction

The system shall extract, when present:

- activity description,
- event type,
- date,
- time,
- discipline,
- location,
- equipment tag,
- line number,
- quantity,
- progress percentage,
- delay/blocker,
- source reference.

---

# 10. Event Types

The MVP shall support:

```text
START
END
PROGRESS
DELAY
BLOCKER
RESUME
```

Possible future events:

```text
CANCEL
REOPEN
MILESTONE
INSPECTION
HOLD
RELEASE
```

---

# 11. Canonical Actual Progress Event

The canonical event should contain:

```json
{
  "event_id": "EVT-001",
  "project_id": "P001",
  "activity_id": "PIP-2401",
  "event_type": "END",
  "event_timestamp": "2026-08-27T17:30:00",
  "recorded_at": "2026-08-28T08:15:00",
  "discipline": "PIPING",
  "location": "Rack B",
  "reported_description": "24 inch line erection completed",
  "normalized_description": "24 inch line erection",
  "extraction_confidence": 0.96,
  "matching_confidence": 0.94,
  "source_document_id": "DOC-001",
  "reported_by": "SUP-001",
  "lifecycle_status": "COMMITTED",
  "verification_status": "SYSTEM_VERIFIED",
  "model_version": "extractor-v1",
  "schema_version": "event-v1"
}
```

The event has exactly two status fields: `lifecycle_status` (PROPOSED → MATCHED → REVIEW_REQUIRED → APPROVED → COMMITTED, or REJECTED) and `verification_status` (UNVERIFIED, SYSTEM_VERIFIED, HUMAN_VERIFIED). `AUTO_ACCEPTED` is not a valid value for either field — a high-confidence auto-link is `lifecycle_status: COMMITTED` with `verification_status: SYSTEM_VERIFIED`.

---

# 12. Temporal Model

The system shall distinguish:

```text
event_timestamp
```

from:

```text
recorded_at
```

Example:

```text
Work happened:
26-Aug

Report received:
30-Aug
```

Future-ready model:

```text
Event time
+
Knowledge/record time
```

This supports late-arriving reports and historical analysis.

---

# 13. Terminology Normalization

The system shall normalize:

```text
spool installed
spool erected
spool mounted
```

into a canonical concept such as:

```text
SPOOL_ERECTION
```

Normalization should combine:

```text
rules
+
project glossary
+
NLP
+
LLM where needed
```

The original phrase must be preserved.

---

# 14. Activity Matching

The system shall use a hybrid approach.

## Layer 1 — Exact matching

Use:

- activity IDs,
- line numbers,
- equipment tags,
- known codes.

## Layer 2 — Fuzzy matching

Use RapidFuzz for lexical similarity.

## Layer 3 — Semantic matching

Use sentence-transformers (locked model: `all-MiniLM-L6-v2`, 384-dim output) + pgvector. The embedding model is fixed before the vector column is created, since the schema's `VECTOR(384)` column and the model's output dimension must match exactly.

## Layer 4 — Domain constraints

Use:

- discipline,
- location,
- WBS,
- date window,
- equipment,
- project,
- activity status.

---

# 15. Match Scoring

Default scoring model:

```text
Final Score =

0.30 × Semantic Similarity
+
0.20 × Text Similarity
+
0.15 × Discipline Match
+
0.10 × Location Match
+
0.10 × Tag/Equipment Match
+
0.10 × WBS Compatibility
+
0.05 × Temporal Feasibility
```

Weights are configurable.

---

# 16. Match Decision Policy

```text
>= 0.90
→ AUTO-LINK

0.70 – 0.89
→ PLANNER REVIEW

< 0.70
→ UNMATCHED / NEW ACTIVITY REVIEW
```

Thresholds must be configurable.

A score is not presented as a statistical probability unless formally calibrated.

---

# 17. Match Explainability

The UI shall show structured reasons.

Example:

```text
PIP-2401
Final Score: 0.94

Semantic similarity      0.94
Text similarity          0.91
Discipline               MATCH
Location                 MATCH
Line number              MATCH
WBS                      MATCH
Temporal feasibility     MATCH
```

This provides explainability without exposing hidden model chain-of-thought.

---

# 18. Granularity Handling

The platform shall support:

```text
1 Field Observation → Multiple Activities
```

and:

```text
Multiple Field Observations → 1 Activity
```

The product should therefore retain an intermediate observation/proposal concept rather than forcing all source information into a single activity immediately.

---

# 19. AI Architecture Requirements

The Python AI service shall:

1. Accept normalized source content.
2. Perform structured extraction.
3. Validate its own output using Pydantic.
4. Produce Match Proposals.
5. Return evidence references.
6. Return confidence values.
7. Return model/version metadata.

The AI service shall not directly modify official schedule state.

---

# 20. Rust Trust Layer Requirements

Rust shall act as the trusted boundary.

It shall:

- authenticate requests,
- authorize users,
- validate event structure,
- validate project scope,
- validate state transitions,
- detect duplicates,
- enforce business rules,
- handle transactions,
- record audit events,
- manage approvals,
- create integration/outbox records.

---

# 21. Activity State Machine

Supported states:

```text
PLANNED
STARTED
IN_PROGRESS
BLOCKED
DELAYED
COMPLETED
CANCELLED
```

Typical path:

```text
PLANNED
   ↓
STARTED
   ↓
IN_PROGRESS
   ↓
COMPLETED
```

Invalid transitions must be rejected unless explicitly configured.

---

# 22. Deduplication

The system shall prevent duplicate event creation using a combination of:

```text
client_event_id
source_document_id
source_record_id
event fingerprint
project
activity
event type
event time
```

When two sources refer to the same physical occurrence, the system should link both as evidence rather than create duplicate schedule updates.

---

# 23. Conflict Resolution

When evidence conflicts:

```text
Evidence A
Evidence B
      ↓
Conflict detector
      ↓
Resolution policy
      ↓
Planner Review
```

The system shall preserve all conflicting evidence.

Source precedence should be project-configurable.

---

# 24. Concurrency Control

The system shall use database transactions and optimistic concurrency.

Activities/events should have a version or equivalent concurrency mechanism.

Example:

```text
Activity version = 7

Update based on version 7
→ accepted
→ version 8

Second update based on old version 7
→ rejected as stale
```

---

# 25. Event Ledger

The system shall maintain an append-oriented event history.

Example:

```text
EVENT-001 START
EVENT-002 PROGRESS 40%
EVENT-003 BLOCKED
EVENT-004 RESUME
EVENT-005 END
```

Current activity state is derived/projected from these events.

---

# 26. Current State Projection

Maintain:

```text
Event Ledger
      ↓
State Projection
      ↓
Current Activity State
```

This makes historical reconstruction possible while keeping current views fast.

---

# 27. Schedule Versioning

Every imported schedule shall have:

```text
schedule_version
```

Activities must remain traceable to their relevant schedule context.

The system should support future activity lineage:

```text
REPLACED_BY
SPLIT_INTO
MERGED_FROM
RENAMED_TO
```

---

# 28. Transactional Outbox

For external PMIS/schedule integration:

```text
PostgreSQL transaction
   |
   +-- Event Ledger
   +-- Current State
   +-- Audit Event
   +-- Outbox Event
```

The outbox worker then performs the external update.

This avoids losing an integration action if the external PMIS is temporarily unavailable.

---

# 29. Idempotent PMIS Integration

Every external schedule update should have an idempotency key such as:

```text
event_id
```

or a derived unique integration identifier.

Retries must not create duplicate updates.

---

# 30. Failure Handling

## Python AI unavailable

System should still support:

- manual event creation,
- manual planner workflows,
- previously processed data.

## Redis unavailable

Use PostgreSQL as the source of truth and continue without cache.

## RabbitMQ unavailable

Queue-dependent processing can be paused/retried without losing already committed project state.

## Object storage unavailable

Existing metadata/events remain available; new uploads fail gracefully and are retried.

## PMIS unavailable

Events remain committed internally and integration is retried through the outbox.

---

# 31. Async Processing

Long-running operations should be asynchronous. RabbitMQ is locked as required MVP infrastructure for this — not a later/optional addition.

```text
Upload
  ↓
202 Accepted
  ↓
job_id
  ↓
RabbitMQ (ai_processing_queue)
  ↓
Worker
  ↓
OCR / Extraction / Embedding / Matching
  ↓
Result published to ai_result_queue
  ↓
Review-ready event
```

Minimum queue design (full detail in Backend Schema/Implementation Plan, Section 9A):

```text
ai_processing_queue    Rust → Python: document ready for processing
ai_result_queue        Python → Rust: extraction/matching result
retry mechanism        TTL-based backoff before re-delivery
dead-letter queue      terminal failures — never silently dropped
```

Recommended states:

```text
RECEIVED
VALIDATING
STORED
EXTRACTING
NORMALIZING
MATCHING
REVIEW_REQUIRED
APPROVED
COMMITTED
FAILED
```

---

# 32. Security Requirements

## Authentication

Prototype:

```text
basic authenticated application access
```

Production target:

```text
OIDC / OAuth 2.0 / organization SSO
```

## Authorization

RBAC plus project/discipline scope.

Example:

```text
Supervisor
→ create own field observations

Planner
→ approve/correct mappings

Manager
→ read project analytics

Auditor
→ read evidence/audit

Admin
→ system configuration
```

Authorization must be enforced server-side.

## Locked Supabase Auth/RLS boundary

```text
Supabase Auth  → issues the identity token
Rust           → validates the token and is the sole enforcer of role/business
                 authorization
Supabase RLS   → an additional database-level protection layer, not the primary
                 authorization mechanism
```

`project_members.user_id` is the Supabase Auth user id. Rust must independently authorize every command; RLS is defense-in-depth, not a substitute for Rust's checks.

---

# 33. Document Security

Uploaded documents are untrusted.

Processing pipeline:

```text
File
 ↓
File validation
 ↓
Size/type limits
 ↓
Security scanning
 ↓
Sandboxed parsing
 ↓
Text extraction
 ↓
Prompt isolation
 ↓
AI processing
```

Documents must never be treated as instruction sources for the LLM.

---

# 34. Project / Tenant Isolation

All project data queries must be project-scoped.

For vector search:

```text
project_id filter
+
vector similarity
```

must be applied within the retrieval operation.

Never retrieve all projects and filter only in the UI.

---

# 35. Evidence Integrity

For every uploaded document:

```text
SHA-256 checksum
```

should be stored.

Event:

```text
event
 ↓
document_id
 ↓
document_hash
```

This allows evidence-integrity checks.

---

# 36. Data Privacy

Prototype:

```text
synthetic/anonymized data only
```

Production:

- data minimization,
- role-based access,
- defined retention policies,
- privacy-aware handling of personal data,
- restricted AI-provider access,
- approved hosting.

---

# 37. Database Requirements

## PostgreSQL

System of record.

Stores:

- project metadata,
- WBS,
- activities,
- schedule versions,
- dependencies,
- events,
- matches,
- approvals,
- audit,
- document metadata,
- embeddings.

## pgvector

Stores semantic representations used by the activity retrieval/matching engine.

---

# 38. Redis Requirements

Redis is non-authoritative.

Use for:

- caching,
- job status,
- rate limiting,
- sessions,
- temporary workflow state,
- candidate-result cache,
- distributed locking where appropriate.

Cache keys must respect project/user authorization scopes.

---

# 39. Object Storage Requirements

MVP (locked):

```text
Supabase Storage
```

Possible future production backends (post-MVP migration, not the current build target):

```text
SeaweedFS
Ceph RGW
approved government object storage
approved cloud S3-compatible storage
```

Application must not hard-code a specific storage vendor — the storage interface stays abstracted so a future migration off Supabase Storage is a configuration change, not a rewrite.

---

# 40. Product Architecture

```text
Experience Plane
    |
    +-- React
    +-- Supervisor UI
    +-- Planner UI
    +-- Manager Dashboard

Intelligence Plane
    |
    +-- Python/FastAPI
    +-- OCR
    +-- NLP
    +-- LLM
    +-- Embeddings
    +-- Matching

Trust Plane
    |
    +-- Rust/Axum
    +-- Authorization
    +-- Validation
    +-- Event Engine
    +-- State Machine
    +-- Audit
    +-- Outbox

Data Plane
    |
    +-- PostgreSQL
    +-- pgvector
    +-- Redis
    +-- Object Storage
```

---

# 41. Locked Technology Stack

## Frontend

```text
React
TypeScript
Tailwind CSS
```

## Rust

```text
Rust
Axum
Tokio
Tower
Serde
SQLx
Reqwest
Tracing
thiserror
anyhow
Validator
```

MVP service-to-service communication (Rust ↔ Python) is REST/JSON. Tonic/Prost (gRPC) is a documented future, post-MVP option only — do not build it now.

## Python

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
sentence-transformers (all-MiniLM-L6-v2, 384-dim)
OCR
ASR
LLM Gateway
```

## Data

```text
PostgreSQL
pgvector
Redis
Supabase Storage (MVP-locked; S3-compatible storage is a future migration option)
```

## Async

```text
RabbitMQ (required for MVP — see Section 31)
```

## Infrastructure

```text
Docker
Docker Compose
Kubernetes for production
```

## Observability

```text
Prometheus
Grafana
Centralized logging / SIEM for production
```

---

# 42. External Integrations

## Baseline Schedule

Possible inputs:

```text
CSV
XLSX
Primavera exports
MS Project exports
```

## PMIS

Prototype:

```text
updated CSV/XLSX export
```

Future:

```text
PMIS API
Primavera API/integration
MS Project integration
organization-specific interface
```

---

# 43. Frontend Modules

```text
/auth
/dashboard
/projects
/schedule
/upload
/events
/matches
/review
/evidence
/analytics
/audit
/settings
```

## Supervisor screen

Focus on:

```text
Speak / Type
Confirm
Submit
```

## Planner screen

Focus on:

```text
Review
Evidence
Confidence
Approve
Correct
Reject
```

## Manager screen

Focus on:

```text
Progress
Variance
Discipline
Delays
Risk signals
```

---

# 44. Dashboard KPIs

Minimum MVP:

```text
Total Activities
Actual Events
Auto-linked
Pending Review
Unmatched
Delayed
Completed
```

Additional:

```text
On-time %
Actual vs Planned
Average Delay
Discipline Progress
Contractor Progress
```

---

# 45. Institutional Memory

Completed projects should contribute:

```text
actual durations
delay causes
productivity
discipline patterns
contractor patterns
recurring bottlenecks
```

Future system:

```text
Historical execution
     ↓
Contextual features
     ↓
Statistical/ML analysis
     ↓
Planning insight
```

The system must preserve context so that historical outliers are not automatically treated as universal benchmarks.

---

# 46. MVP Data Model

Core tables:

```text
projects
wbs_nodes
activities
activity_dependencies
schedule_versions

documents
document_extractions

work_observations
match_proposals
actual_events
approvals
audit_events

users
roles
permissions

contractors
disciplines
locations

outbox_events
activity_lineage
terminology_glossary
```

Table names are locked as shown above. `event_observations`, `event_matches`, and `event_approvals` are not used anywhere in the system.

---

# 47. MVP API

```text
POST   /api/v1/projects
GET    /api/v1/projects/:id

POST   /api/v1/schedules/import

POST   /api/v1/documents
GET    /api/v1/documents/:id
POST   /api/v1/documents/:id/process

POST   /api/v1/events
GET    /api/v1/events/:id

GET    /api/v1/activities/:id
GET    /api/v1/matches/:event_id

POST   /api/v1/matches/:id/approve
POST   /api/v1/matches/:id/reject
POST   /api/v1/matches/:id/correct

GET    /api/v1/dashboard
GET    /api/v1/audit/:entity_id

GET    /api/v1/export/schedule
```

Internal Python APIs use REST/JSON for the MVP (locked). gRPC/Tonic/Prost is a documented future option for production service-to-service communication and must not be built now.

---

# 48. MVP Workflow — Single Authoritative Flow

This is the one flow every part of the system follows. Every other journey, diagram, or example in this document (and in the TRD and Backend Schema/Implementation Plan) is an illustration of this same flow, not an alternative to it.

```text
1.  Upload
2.       ↓ Supabase Storage
3.  Document record created (Rust)
4.       ↓ RabbitMQ job (ai_processing_queue)
5.  Python: extraction / normalization / matching
6.  Match Proposal created
7.       ↓ ai_result_queue
8.  Rust validation
9.       ↓
10. Auto-Link  /  Planner Review  /  Unmatched
11.      ↓ (Rust commits)
12. Actual Event (lifecycle_status → COMMITTED)
13.      ↓
14. Audit event + Current State updated
15.      ↓
16. Dashboard refresh
17. Schedule Export
```

Expanded, with the demo project/schedule setup steps that precede the first upload:

```text
1. Create demo project
2. Import L5/L6 schedule
3. Upload daily report / discipline spreadsheet → Supabase Storage
4. Rust creates document record → RabbitMQ job (ai_processing_queue)
5. Python: extract source content → create work_observations
6. Normalize terminology
7. Generate embeddings (sentence-transformers/all-MiniLM-L6-v2)
8. Retrieve candidate activities
9. Calculate hybrid score → create match_proposals
10. Rust validates the proposal
11. Auto-link high-confidence matches / Send ambiguous matches to planner / Unmatched queue
12. Commit actual_events to PostgreSQL (lifecycle_status: PROPOSED → MATCHED → REVIEW_REQUIRED → APPROVED → COMMITTED)
13. Write audit event
14. Update current activity state
15. Refresh dashboard
16. Generate schedule export
```

---

# 49. MVP Demo Scenarios

The demo shall contain at least five cases.

## Case 1 — Exact match

Expected:

```text
high confidence
auto-link
```

## Case 2 — Semantic match

Expected:

```text
field wording ≠ schedule wording
successful semantic mapping
```

## Case 3 — Ambiguous match

Expected:

```text
planner review
```

## Case 4 — Unmatched/new work

Expected:

```text
unmatched queue
```

## Case 5 — Invalid event

Expected:

```text
Rust validation rejection
```

Example:

```text
Actual Finish < Actual Start
```

---

# 50. Prototype Deployment

## Public demo architecture

```text
                     INTERNET
                        |
                        v
                Cloudflare Pages
                React + TypeScript
                        |
                        v
                  Rust / Axum
                        |
             +----------+----------+
             |                     |
             v                     v
      Managed PostgreSQL       Python/FastAPI
          + pgvector                |
                                    |
                          +---------+---------+
                          |         |         |
                          v         v         v
                         OCR       NLP       LLM
```

Object storage (locked for MVP):

```text
Supabase Storage
```

RabbitMQ is required for the MVP (see Section 31) — it can run as a single lightweight instance. Redis may remain local or be deployed only when needed.

---

# 51. Low-Cost Prototype Principle

Use:

```text
Open-source frameworks
+
Free/low-cost deployment tiers
+
Local AI where practical
+
Synthetic data
```

Avoid unnecessary production infrastructure during SIH.

Prototype should prioritize:

```text
Correctness
Demonstrability
Reliability
Security basics
```

over:

```text
Kubernetes
multi-region
large-scale clusters
```

---

# 52. Production Government Architecture

```text
                         WAF / LB
                            |
                            v
                      API Gateway
                            |
                            v
                     Kubernetes
                     /    |                        /     |                      Rust   Python  Workers
                    \     |     /
                     \    |    /
                      PostgreSQL
                          |
                    +-----+-----+
                    |           |
                  Redis     Object Storage
                    |           |
                    +-----+-----+
                          |
                       Backup
                          |
                          v
                       DR Site
```

Potential hosting:

```text
Government data centre
NIC/National Cloud
GI Cloud/approved cloud
PSU data centre
other organization-approved Indian infrastructure
```

Production hosting and security approvals remain subject to the target organization's policies.

---

# 53. Non-Functional Requirements

## NFR-001 — Reliability

Committed events should not be lost because an AI, queue, cache, or external integration service fails.

## NFR-002 — Auditability

Every approved schedule-impacting event must be traceable to evidence and an actor.

## NFR-003 — Explainability

Every activity match should provide structured feature evidence.

## NFR-004 — Security

No public database/Redis/object-store credentials.

## NFR-005 — Scalability

Architecture shall support horizontal scaling of:

```text
Rust API
Python workers
matching workers
```

## NFR-006 — Performance

Interactive UI operations should normally return quickly; long AI/document operations should be asynchronous.

## NFR-007 — Availability

The system should degrade gracefully when non-authoritative dependencies fail.

## NFR-008 — Portability

Storage, LLM, hosting, and infrastructure providers should be replaceable through interfaces/configuration.

---

# 54. Security & Government Readiness

The system should be designed toward applicable Indian government security and privacy expectations.

Production should account for:

```text
RBAC
least privilege
TLS
encryption at rest
private networking
secure backups
audit logging
centralized monitoring
log retention requirements
security testing
privacy controls
approved hosting
```

The prototype should make no claim of government certification or formal security accreditation.

Production deployment would require the applicable organizational security audit, hosting approval, data classification, and operational controls.

---

# 55. Success Metrics

## Core product metrics

### Extraction

```text
Event extraction accuracy
Date/time extraction accuracy
Event-type accuracy
```

### Matching

```text
Top-1 accuracy
Top-3 recall
Auto-link precision
Unmatched rate
Planner correction rate
```

### Operations

```text
Processing time/report
Average review time
Duplicate-event rate
Conflict rate
```

### Trust

```text
% events with evidence
% events with confidence
% schedule-impacting events with audit
% false auto-links
```

---

# 56. Prototype Acceptance Criteria

The prototype is accepted when:

```text
[ ] A sample L5/L6 schedule is imported.
[ ] A PDF daily report is ingested.
[ ] A discipline spreadsheet is ingested.
[ ] Source text is extracted.
[ ] Structured events are generated.
[ ] Field terminology is normalized.
[ ] Candidate activities are retrieved.
[ ] Hybrid matching returns ranked candidates.
[ ] Confidence and score factors are visible.
[ ] High-confidence events can be auto-linked.
[ ] Ambiguous events enter planner review.
[ ] Unmatched events are not silently discarded.
[ ] Invalid state/date transitions are rejected by Rust.
[ ] Approved events are persisted to PostgreSQL.
[ ] Original evidence is retained.
[ ] Audit records are created.
[ ] Dashboard updates from committed events.
[ ] Updated schedule export is generated.
[ ] Public demo deployment works.
[ ] Demo can be reset to clean seed data.
```

---

# 57. Release Plan

## Release 0 — Engineering Skeleton

```text
Repository
Docker
React
Rust
Python
PostgreSQL
```

## Release 1 — Schedule + Events

```text
Schedule import
Event model
Rust API
PostgreSQL
```

## Release 2 — Ingestion

```text
PDF
Excel
Document storage
Extraction
```

## Release 3 — Intelligence

```text
Normalization
Embeddings
Fuzzy matching
Semantic matching
Confidence
```

## Release 4 — Trust

```text
State machine
Validation
Approval
Audit
Deduplication
```

## Release 5 — Product

```text
Planner review
Evidence
Dashboard
Schedule export
```

## Release 6 — Deployment

```text
Public deployment
Seed data
Demo hardening
Monitoring
```

## Release 7 — Stretch

```text
Voice
OCR
Offline sync
Delay analytics
Institutional memory
```

---

# 58. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Wrong AI match | High | Hybrid matching + thresholds + planner review |
| Duplicate reports | High | Idempotency + deduplication |
| Conflicting sources | High | Conflict detection + evidence provenance |
| Late reports | Medium | event time vs recorded time |
| Schedule revisions | High | schedule versioning + lineage |
| Bad OCR | Medium | confidence + normalization + raw evidence |
| LLM unavailable | Medium | deterministic fallback + manual entry |
| Redis failure | Low/Medium | cache-aside; PostgreSQL remains truth |
| PMIS outage | High | transactional outbox + retry |
| File attack | High | file validation + sandboxing |
| Cross-project leakage | Critical | server-side project authorization + scoped vector search |
| Offline duplicates | Medium | client_event_id + idempotency |
| Model updates | Medium | model/prompt/rule versioning |
| Historical misinformation | Medium | contextualized institutional memory |
| Overengineering | High | focus on MVP business loop |

---

# 59. Product Principles

## Principle 1

**Never silently drop an observation.**

## Principle 2

**Never let the LLM directly modify authoritative schedule state.**

## Principle 3

**Never present an unsupported AI score as certainty.**

## Principle 4

**Every schedule-impacting event must have provenance.**

## Principle 5

**Cache is not truth.**

## Principle 6

**Historical data must preserve context.**

## Principle 7

**Human approval is a governance mechanism, not an AI failure.**

## Principle 8

**The architecture must survive replacement of the LLM, cloud, object store, and cache.**

---

# 60. Future Roadmap

## Phase 2

- Voice Time Agent
- Mobile field interface
- Better OCR
- ASR
- Delay reason taxonomy
- richer analytics

## Phase 3

- Historical execution repository
- Forecasting
- productivity models
- contractor benchmarking
- discipline intelligence

## Phase 4

- Primavera/PMIS integration
- Offline synchronization
- enterprise IAM
- government deployment

## Phase 5

- Cross-project institutional learning
- predictive schedule risk
- planning recommendations
- reusable project execution patterns

---

# 61. The Core Product Loop

```text
             FIELD REALITY
                   |
                   v
                EVIDENCE
                   |
                   v
               OBSERVATION
                   |
                   v
             AI EXTRACTION
                   |
                   v
            NORMALIZATION
                   |
                   v
          CANDIDATE RETRIEVAL
                   |
                   v
           HYBRID MATCHING
                   |
                   v
             CONFIDENCE
                   |
        +----------+----------+
        |                     |
        v                     v
     HIGH                  AMBIGUOUS
        |                     |
        v                     v
    AUTO-LINK             HUMAN REVIEW
        |                     |
        +----------+----------+
                   |
                   v
             RUST VALIDATION
                   |
                   v
             EVENT LEDGER
                   |
                   +--------> AUDIT
                   |
                   +--------> CURRENT STATE
                   |
                   +--------> OUTBOX
                                 |
                                 v
                              PMIS
                                 |
                                 v
                             ANALYTICS
                                 |
                                 v
                       INSTITUTIONAL MEMORY
```

---

# 62. Final Product Definition

NEXORA AI is not primarily a chatbot.

It is an **evidence-first, human-governed actual-progress intelligence layer** between field execution and structured project planning systems.

Its distinguishing capabilities are:

```text
Heterogeneous ingestion
+
Semantic/discipline-aware activity linking
+
Confidence-scored automation
+
Human-in-the-loop governance
+
Trusted Rust validation
+
Auditable event history
+
Evidence provenance
+
Schedule integration
+
Institutional memory
```

The product's ultimate outcome is:

> **Turn fragmented execution reports into trusted, structured, continuously improving project knowledge.**
