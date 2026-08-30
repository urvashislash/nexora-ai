# NEXORA AI — Technical Requirements Document (TRD)

**Project:** Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management  
**Theme:** Smart Automation  
**Target:** Smart India Hackathon prototype with a production-oriented Government/PSU architecture  
**Status:** Locked Technical Baseline

---

## 1. Technical Objective

NEXORA AI shall transform heterogeneous field-execution inputs into **evidence-backed, confidence-scored actual-progress events**, link them to L5/L6 schedule activities, validate them through a trusted Rust domain layer, route uncertain cases to planners, and persist an auditable project-execution history.

Core principle:

```text
AI PROPOSES
   ↓
RULES VALIDATE
   ↓
HUMAN GOVERNS WHEN REQUIRED
   ↓
POSTGRESQL COMMITS
   ↓
AUDIT RECORDS
   ↓
PMIS / ANALYTICS CONSUME
```

The LLM shall never directly modify authoritative schedule state.

---

# 1A. Locked MVP Decisions

These decisions are final for the SIH MVP and are shared verbatim with the PRD and the Backend Schema/Implementation Plan. They must not be re-opened during implementation without an explicit scope change.

```text
1. Storage      → Supabase Storage only for the MVP. S3-compatible self-hosted storage
                   (e.g. SeaweedFS) is a documented future migration option, not a
                   current build target.

2. Queue        → RabbitMQ is required MVP infrastructure. Minimum queue design:
                   ai_processing_queue, ai_result_queue, retry (TTL + DLX), and a
                   dead-letter queue.

3. Service comm → REST/JSON only between Rust and Python for the MVP. gRPC/Tonic/Prost
                   is a future, post-MVP option and must not be built now.

4. DB names     → work_observations, match_proposals, actual_events, approvals,
                   audit_events. event_observations, event_matches, and event_approvals
                   are not used anywhere.

5. Event status → lifecycle_status: PROPOSED → MATCHED → REVIEW_REQUIRED → APPROVED →
                   COMMITTED (failure: REJECTED). verification_status: UNVERIFIED,
                   SYSTEM_VERIFIED, HUMAN_VERIFIED. AUTO_ACCEPTED is not a valid status.

6. Auth/RLS     → Rust is the sole enforcer of business authorization; Supabase RLS is
                   an additional database-level layer, not the primary mechanism.
                   project_members.user_id is the Supabase Auth user id.

7. Embedding    → sentence-transformers/all-MiniLM-L6-v2 (384-dim), matching the
                   VECTOR(384) activities.embedding column.

8. MVP flow     → One authoritative flow governs the whole build (see PRD Section 48 /
                   Backend Schema Section 23). All other flow diagrams illustrate it.
```

---

# 2. Locked Technology Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React | Web UI |
| Frontend language | TypeScript | Type safety |
| Styling | Tailwind CSS | UI |
| Core backend | Rust | Trusted platform |
| API | Axum | REST |
| Async runtime | Tokio | Concurrency |
| Middleware | Tower | Security/request middleware |
| Serialization | Serde | JSON |
| Database access | SQLx | PostgreSQL |
| Internal RPC | REST/JSON (MVP) | Rust ↔ Python — Tonic + Prost (gRPC/Protobuf) deferred to post-MVP |
| HTTP client | Reqwest | integrations |
| Logging | Tracing | Observability |
| Error handling | thiserror + anyhow | Errors |
| AI backend | Python | AI/data processing |
| Python API | FastAPI | AI service |
| Validation | Pydantic v2 | Typed contracts |
| Data processing | Polars + Pandas | Tabular processing |
| PDF | PyMuPDF | PDF extraction |
| Excel | openpyxl | XLSX |
| NLP | spaCy | NLP/entities |
| Fuzzy matching | RapidFuzz | Lexical matching |
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 (384-dim) | Semantic vectors |
| LLM | Model-agnostic gateway | Extraction/normalization |
| Primary DB | PostgreSQL | System of record |
| Vector | pgvector | Semantic search |
| Cache | Redis | Temporary/cache state |
| Queue | RabbitMQ | Async jobs — required for MVP |
| Object storage (MVP) | Supabase Storage | Evidence — locked for the MVP |
| Object storage (future) | S3-compatible (e.g. SeaweedFS) | Post-MVP self-hosted migration target |
| Containers | Docker | Packaging |
| Local orchestration | Docker Compose | Development |
| Production orchestration | Kubernetes | Production where required |
| Metrics | Prometheus | Monitoring |
| Dashboards | Grafana | Monitoring |

---

# 3. Logical Architecture

```text
                         EXPERIENCE PLANE
       Supervisor | Planner | Manager | Auditor
                            |
                            v
                         Web/Mobile
                            |
                            v
                     WAF / API Gateway
                            |
                            v
                    +-------------------+
                    | RUST TRUST PLANE  |
                    | Axum + Tokio      |
                    |                   |
                    | Auth/RBAC         |
                    | Commands/Queries  |
                    | Validation        |
                    | State Machine     |
                    | Event Ledger      |
                    | Approval          |
                    | Audit             |
                    | Outbox            |
                    | PMIS Adapter      |
                    +---------+---------+
                              |
              +---------------+---------------+
              |               |               |
              v               v               v
        PostgreSQL          Redis         Object Storage
         + pgvector         Cache           S3 API
              |
              v
        RabbitMQ / Jobs
              |
              v
             PYTHON AI PLANE
                FastAPI
                  |
       +----------+----------+----------+
       |          |          |          |
      OCR        NLP        LLM     Embeddings
       |          |          |          |
       +----------+----------+----------+
                         |
                         v
                  Match Proposal
                         |
                         v
                   RUST TRUST PLANE
                         |
                 +-------+-------+
                 |               |
               Auto          Human Review
                 |               |
                 +-------+-------+
                         |
                         v
                    Event Ledger
                         |
                +--------+--------+
                |                 |
                v                 v
          Current State         Outbox
                |                 |
                v                 v
             Redis          PMIS / Schedule
                                |
                                v
                        Analytics / Memory
```

---

# 4. Architecture Boundaries

## Rust owns

- authentication integration
- authorization/RBAC
- project/tenant isolation
- event commands
- business rules
- state transitions
- deduplication
- temporal validation
- approval workflow
- event persistence
- audit generation
- transactional outbox
- schedule/PMIS integration

## Python owns

- document parsing
- OCR/ASR integration
- NLP
- extraction
- normalization
- embeddings
- candidate retrieval
- hybrid matching
- AI analytics
- forecasting

## PostgreSQL owns

- authoritative project data
- schedule representation
- event ledger
- approvals
- audit metadata
- current state
- embeddings

## Redis owns

- cache
- session/temporary state
- rate-limit counters
- distributed locks
- job status

## Object storage owns

- original evidence files
- processed files
- generated artifacts

---

# 5. Input Requirements

Required prototype inputs:

1. L5/L6 schedule export.
2. PDF daily progress report.
3. Discipline spreadsheet.

Optional:

- text
- scanned PDF/image
- voice

Supported sources shall converge to a common observation model.

```text
PDF ──┐
XLSX ─┤
Text ─┼──> Canonical Observation
Voice ─┤
Image ─┘
```

---

# 6. Canonical Observation

```json
{
  "observation_id": "OBS-001",
  "project_id": "P001",
  "source_type": "DAILY_REPORT",
  "event_time": "2026-08-27T17:30:00",
  "recorded_at": "2026-08-28T09:10:00",
  "discipline": "PIPING",
  "raw_text": "24 inch line P-101 erection completed at Rack B.",
  "normalized_text": "24 inch line erection completed",
  "location": "Rack B",
  "line_number": "P-101"
}
```

The system shall distinguish **when work happened** from **when it was reported**.

---

# 7. Core Data Model

## Project hierarchy

```text
Project
  ↓
WBS Node
  ↓
Activity
  ↓
Actual Event
```

## Core entities

```text
projects
wbs_nodes
activities
activity_dependencies
schedule_versions
activity_lineage

disciplines
locations
contractors

documents
document_extractions

work_observations
match_proposals
actual_events
approvals
activity_current_state

audit_events
outbox_events

users
roles
permissions
```

Table names are locked as shown above. `event_observations`, `event_matches`, and `event_approvals` are not used anywhere in the system — they are legacy names from an earlier draft and must not be (re)created.

---

# 8. Actual Progress Event

Required fields:

```text
event_id
project_id
activity_id
event_type

event_time
recorded_at
time_precision

discipline
contractor
location

reported_description
normalized_description

quantity
unit
progress_percent
measurement_basis

extraction_confidence
matching_confidence

source_document_id
source_reference

verification_status
lifecycle_status

model_name
model_version
prompt_version
embedding_model
matcher_version
schema_version

reported_by
approved_by
approved_at

created_at
updated_at
```

---

# 9. Event Types

```text
START
END
PROGRESS
BLOCKER
DELAY
RESUME
CANCEL
OBSERVATION
```

Verification (`verification_status` — exactly these three values, no others):

```text
UNVERIFIED         no decision made yet
SYSTEM_VERIFIED     confidence policy auto-linked the event
HUMAN_VERIFIED       planner reviewed and approved/corrected the event
```

Lifecycle (`lifecycle_status` — exactly these six values, no others):

```text
PROPOSED
MATCHED
REVIEW_REQUIRED
APPROVED
REJECTED
COMMITTED
```

`AUTO_ACCEPTED` is not a valid value in either list. A high-confidence auto-linked event is `lifecycle_status = COMMITTED` (or `APPROVED` pre-commit) combined with `verification_status = SYSTEM_VERIFIED` — never a status of its own. `EXTRACTED`/`FAILED` describe document/job **processing_status** (Section 24), a separate field from the event's own lifecycle_status, and should not be confused with it.

---

# 10. Event Ledger

The event history shall be append-oriented.

```text
START
   ↓
PROGRESS
   ↓
BLOCKER
   ↓
RESUME
   ↓
END
```

Do not overwrite history with only a mutable `actual_start` and `actual_finish`.

Maintain:

```text
event ledger
+
current state projection
```

This supports auditability and historical reconstruction.

---

# 11. State Machine

```text
PLANNED
   ↓
STARTED
   ↓
IN_PROGRESS
   ↓
COMPLETED
```

Exceptional states:

```text
BLOCKED
DELAYED
CANCELLED
```

Rust shall enforce legal transitions.

Examples of invalid operations:

```text
FINISH < START
duplicate START
COMPLETED → STARTED
wrong project
unauthorized update
```

---

# 12. Schedule Versioning

Schedule versions are first-class entities.

```text
Project
  ├── Schedule V1
  ├── Schedule V2
  └── Schedule V3
```

Historical events shall remain interpretable after schedule revisions.

Activity lineage supports:

```text
REPLACED_BY
SPLIT_INTO
MERGED_FROM
RENAMED_TO
SUPERSEDES
```

---

# 13. AI Extraction Pipeline

```text
Source
  ↓
File Validation
  ↓
Secure Storage
  ↓
Parser/OCR/ASR
  ↓
Text
  ↓
Rule Extraction
  ↓
NLP
  ↓
LLM Structured Extraction
  ↓
Pydantic Validation
  ↓
Canonical Observation
```

Extract where possible:

```text
discipline
event type
activity description
date/time
location
equipment/tag
line number
quantity
unit
progress
delay
blocker
```

---

# 14. Hybrid Schedule Matching

The matcher shall use:

```text
1. Exact identifiers
2. Fuzzy lexical matching
3. Semantic/vector matching
4. Discipline constraints
5. Location constraints
6. WBS compatibility
7. Temporal feasibility
8. Equipment/tag compatibility
```

Baseline score:

```text
Final Score =

0.30 × Semantic Similarity
+ 0.20 × Text Similarity
+ 0.15 × Discipline Match
+ 0.10 × Location Match
+ 0.10 × Tag/Equipment Match
+ 0.10 × WBS Compatibility
+ 0.05 × Temporal Feasibility
```

Weights must be configurable.

---

# 15. Matching Policy

```text
>= 0.90
AUTO-LINK

0.70–0.89
PLANNER REVIEW

< 0.70
UNMATCHED / NEW ACTIVITY REVIEW
```

The numeric score shall be presented as a matching score unless statistically calibrated; it should not be represented as a probability by default.

---

# 16. Granularity Mismatch

The system shall support:

```text
one observation → multiple activities
multiple observations → one activity
```

Example:

```text
"12 spools installed"
        |
        +--> Activity A
        +--> Activity B
        +--> Activity C
```

Use an intermediate observation/allocation model rather than assuming one-to-one mapping.

---

# 17. Terminology Normalization

Store project-specific:

```text
canonical terms
synonyms
abbreviations
discipline-specific wording
location aliases
equipment aliases
unit mappings
```

Example:

```text
"spool erected"
"spool installed"
"spool mounted"

       ↓

SPOOL_ERECTION
```

Original wording must remain available as evidence.

---

# 18. Evidence and Provenance

Every decision shall support:

```text
source document
page/section/reference
raw statement
extracted values
candidate activities
component scores
final score
model/version
approval history
```

Document integrity:

```text
SHA-256 checksum
```

---

# 19. Document Security

Documents are untrusted input.

Pipeline:

```text
Upload
  ↓
File type validation
  ↓
Size/page/row limits
  ↓
Checksum
  ↓
Content/malware scanning where available
  ↓
Sandboxed processing
  ↓
Extraction
```

Documents must not be allowed to inject instructions into the system/LLM policy.

---

# 20. Idempotency

Every retriable command shall support idempotency.

Useful identifiers:

```text
client_event_id
idempotency_key
device_id
source_document_id
```

Duplicate submissions must not create duplicate authoritative events.

---

# 21. Concurrency

Use PostgreSQL transactions plus optimistic concurrency.

Records should support:

```text
version
updated_at
```

A stale update must be rejected/reviewed rather than silently overwriting another change.

---

# 22. Conflict Detection

If two sources disagree:

```text
Report A → END = 27-Aug
Report B → END = 28-Aug
```

create:

```text
CONFLICTING_EVIDENCE
```

Then resolve through:

```text
project policy
+
planner review
```

Do not silently pick the first-arriving report.

---

# 23. Transactional Outbox

For external side effects:

```text
BEGIN TRANSACTION

insert event
update current state
insert audit record
insert outbox record

COMMIT
```

Then:

```text
Outbox Worker
   ↓
PMIS / schedule adapter
```

Retries use an idempotency key.

This prevents database state and external schedule updates from drifting due to partial failures.

---

# 24. Async Processing

Long-running AI operations should not block normal API requests.

```text
POST /documents
     ↓
202 Accepted
     ↓
job_id
     ↓
RabbitMQ
     ↓
worker
     ↓
AI pipeline
```

Job states:

```text
RECEIVED
VALIDATING
STORED
EXTRACTING
NORMALIZING
MATCHING
REVIEW_REQUIRED
COMPLETED
FAILED
```

Failed jobs go to a dead-letter queue.

## RabbitMQ is required MVP infrastructure

RabbitMQ is not a later/optional item — it is required before AI-pipeline coding begins. Minimum queue design (full detail in Backend Schema/Implementation Plan, Section 9A):

```text
ai_processing_queue     Rust → Python: document ready for processing
ai_result_queue         Python → Rust: extraction/matching result
ai_processing_retry_queue   TTL-based backoff, dead-letters back to ai_processing_queue
ai_processing_dlq       terminal failures — document stays visible, never silently dropped
```

Every message carries `project_id`, `document_id`, `job_id`, and `correlation_id` for project-scoped, traceable processing.

---

# 25. Graceful Degradation

| Failure | Behavior |
|---|---|
| Redis down | Use DB-backed path |
| LLM down | Use rules/NLP/manual path |
| AI worker down | Queue jobs |
| RabbitMQ down | Use supported synchronous path |
| Object storage down | Existing structured data remains available |
| PMIS down | Outbox retries |
| PostgreSQL down | Authoritative writes unavailable |

The system should fail predictably.

---

# 26. Project/Tenant Isolation

All reads and writes must be project-scoped.

Vector retrieval must apply the project filter inside retrieval.

```sql
WHERE project_id = :project_id
ORDER BY embedding <-> :query_vector
LIMIT 10;
```

Never retrieve globally and filter only in frontend code.

---

# 27. Cache Design

Redis stores:

```text
activity cache
dashboard cache
candidate match cache
session state
rate limits
job status
distributed locks
```

Use cache-aside:

```text
Read Redis
   ↓ miss
PostgreSQL
   ↓
populate Redis
```

Writes:

```text
PostgreSQL commit
   ↓
invalidate/update cache
```

Redis is not authoritative.

---

# 28. Object Storage Design

Use a storage abstraction so the backing provider is swappable.

MVP (locked):

```text
Supabase Storage
```

Future production options (post-MVP migration, not current build targets):

```text
approved government object storage
Ceph RGW
SeaweedFS
other approved S3-compatible storage
```

Application interface:

```text
upload
download
delete
exists
create signed access
```

The application should not depend on a specific provider.

---

# 29. Security Architecture

```text
Internet
   ↓
WAF / LB
   ↓
API Gateway
   ↓
Rust
   ↓
Private network
   ├── Python
   ├── Redis
   ├── PostgreSQL
   └── Object Storage
```

Controls:

```text
HTTPS
OIDC/OAuth 2.0
RBAC
server-side authorization
private databases
least privilege
rate limiting
input validation
secret management
encryption at rest
audit logging
centralized logging
dependency scanning
```

---

# 30. Authentication and RBAC

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

Permissions are evaluated by:

```text
identity
role
project
discipline
resource
action
```

Frontend visibility is not a security control.

## Locked Supabase Auth/RLS boundary (MVP)

```text
Supabase Auth  → issues the identity token
Rust           → validates the token; is the sole enforcer of role/business authorization
Supabase RLS   → additional database-level protection layer, not the primary
                 authorization mechanism
```

`project_members.user_id` is the Supabase Auth user id — RLS policies join through `project_members.user_id = auth.uid()`. Rust must never treat RLS as a substitute for its own authorization checks; RLS protects against direct or misconfigured database access, it does not replace Section 4's "Rust owns authorization/RBAC."

---

# 31. Audit Model

Audit fields:

```text
audit_id
event_type
entity_type
entity_id
project_id
actor_id
actor_role_at_time
timestamp
old_value
new_value
reason
source_reference
model_version
request_id
correlation_id
```

Production application/security logs should integrate with the organization's approved centralized logging/SIEM platform.

CERT-In's directions require covered entities, including government organizations, to enable ICT-system logs and maintain them securely for a rolling 180 days within Indian jurisdiction; production implementation must map this to the applicable organizational logging and retention policy.

---

# 32. Government Data Handling

The prototype shall use:

```text
synthetic
anonymized
illustrative
```

data.

Production shall support:

```text
data classification
retention policies
access control
encryption
audit
approved hosting
```

External LLM use should be controlled by deployment/data-classification policy.

Prefer:

```text
local/on-prem
private approved model
approved controlled endpoint
```

when required.

---

# 33. API Design

External REST endpoints:

```http
POST   /api/v1/documents
GET    /api/v1/documents/{id}
POST   /api/v1/documents/{id}/process
GET    /api/v1/jobs/{id}

POST   /api/v1/events
GET    /api/v1/events/{id}
GET    /api/v1/activities/{id}/events

GET    /api/v1/matches/{event_id}
POST   /api/v1/matches/{id}/approve
POST   /api/v1/matches/{id}/reject
POST   /api/v1/matches/{id}/correct

GET    /api/v1/dashboard
GET    /api/v1/audit/{entity_id}
```

Internal AI API:

```http
POST /internal/v1/extract
POST /internal/v1/normalize
POST /internal/v1/embed
POST /internal/v1/match
```

Future internal high-throughput communication (post-MVP only — do not build now):

```text
gRPC + Protobuf
```

---

# 34. API Error Model

Errors shall be structured.

```json
{
  "code": "TEMPORAL_CONSTRAINT_VIOLATION",
  "message": "Actual finish precedes actual start.",
  "request_id": "REQ-001"
}
```

Standard codes:

```text
UNAUTHORIZED
FORBIDDEN
VALIDATION_ERROR
DUPLICATE_EVENT
ACTIVITY_NOT_FOUND
LOW_CONFIDENCE
CONFLICTING_EVIDENCE
INVALID_STATE_TRANSITION
STORAGE_ERROR
AI_PROCESSING_ERROR
PMIS_INTEGRATION_ERROR
```

---

# 35. Non-Functional Requirements

## Performance

Initial prototype targets:

```text
normal read p95 < 500 ms
simple write p95 < 1 sec
candidate retrieval < 1 sec
```

AI/OCR operations are asynchronous.

## Scalability

Horizontally scale:

```text
Rust API
Python workers
document workers
matching workers
```

## Availability

No single cache/AI worker failure should corrupt authoritative project state.

## Maintainability

Use:

```text
typed APIs
schema migrations
versioned AI contracts
modular services
automated tests
```

---

# 36. Versioning

Every AI-derived decision should retain:

```text
model_name
model_version
prompt_version
embedding_model
embedding_version
matcher_version
rule_version
schema_version
```

Every event payload should have a schema version.

---

# 37. Testing Strategy

## Unit

Rust:

```text
state machine
validation
authorization
idempotency
domain rules
```

Python:

```text
extraction
normalization
matching
confidence scoring
```

## Integration

```text
PDF
→ extraction
→ matching
→ Rust validation
→ PostgreSQL
→ dashboard
```

## Golden dataset

Maintain:

```text
50–100 labeled field observations
```

with expected activity/event values.

---

# 38. AI Evaluation

Track:

```text
field extraction accuracy
event-type accuracy
date accuracy
Top-1 match accuracy
Top-3 recall
false auto-link rate
unmatched rate
planner correction rate
```

Primary safety metric:

```text
precision of auto-linked events
```

False automatic updates should be minimized even if that means more planner review.

---

# 39. Performance / Failure Testing

Test:

```text
100 concurrent dashboard requests
100 concurrent event writes
large PDF
large spreadsheet
queue backlog
Redis failure
Python failure
LLM failure
object-storage failure
PMIS timeout
duplicate submission
conflicting evidence
```

---

# 40. SIH Prototype Deployment

Recommended low-cost topology:

```text
Internet
   |
   v
Cloudflare Pages
React + TypeScript
   |
   v
Render / equivalent
Rust + Axum
   |
   +--------------------+
   |                    |
   v                    v
Managed PostgreSQL    Python/FastAPI
+ pgvector                |
                          +-- OCR
                          +-- NLP
                          +-- Embeddings
                          +-- LLM
   |
   v
Object Storage
Supabase Storage (locked for MVP)
```

RabbitMQ is required for the MVP (Section 24) but can run as a single lightweight instance; it does not need a managed/clustered deployment at this scale. Redis can remain local/lightweight if the workload does not justify a managed deployment.

---

# 41. Self-Hosted Object Storage (Future / Post-MVP)

This section describes a **future migration path**, not the MVP build. The MVP uses Supabase Storage exclusively (Section 28).

Potential future low-cost self-hosted setup, once a migration off Supabase Storage is actually needed:

```text
Oracle Cloud VM
   ↓
Ubuntu
   ↓
Docker
   ↓
SeaweedFS
   ↓
S3-compatible API
```

Keep storage private and access it through the Rust backend or controlled signed access.

Do not expose permanent storage credentials to the frontend.

---

# 42. Local Development

Use Docker Compose for:

```text
PostgreSQL + pgvector
Redis
RabbitMQ
```

Object storage for local development uses the Supabase Storage bucket for the dev project (or Supabase's local emulation) — no local S3-compatible service is needed for the MVP.

Run:

```text
Rust
Python
React
```

with local development tooling.

Goal:

```bash
docker compose up
```

starts the core infrastructure.

---

# 43. Production Deployment

```text
Government-approved infrastructure
        |
        v
WAF / Load Balancer
        |
        v
Kubernetes where appropriate
        |
        +-- Rust
        +-- Python
        +-- Workers
        |
        +-- PostgreSQL HA
        +-- Redis/Valkey
        +-- RabbitMQ/Kafka as required
        +-- S3-compatible object storage
        |
        +-- Backup
        +-- DR
        +-- SIEM
```

The SIH prototype does not need Kubernetes.

---

# 44. MVP Functional Acceptance

The prototype shall demonstrate:

```text
1. Import schedule.
2. Upload daily report.
3. Upload discipline spreadsheet.
4. Extract activity information.
5. Normalize terminology.
6. Retrieve candidate L5/L6 activities.
7. Calculate hybrid match score.
8. Show evidence.
9. Auto-link high-confidence result.
10. Route ambiguous result to planner.
11. Validate through Rust.
12. Persist event.
13. Create audit entry.
14. Update dashboard.
15. Export updated schedule.
```

---

# 45. Mandatory Demo Scenarios

## Scenario A — Exact

```text
Explicit activity ID
→ high confidence
→ auto-link
```

## Scenario B — Semantic

```text
Different wording
→ semantic match
→ correct activity
```

## Scenario C — Ambiguous

```text
Two plausible activities
→ planner review
```

## Scenario D — New work

```text
No suitable schedule node
→ unmatched/new activity queue
```

## Scenario E — Invalid

```text
Finish before start
→ Rust rejects
```

---

# 46. Project Build Priorities

```text
P0
Repository
Database
RabbitMQ queue design (ai_processing/result/retry/DLQ)
Schedule import
Rust event engine
Supabase Storage integration
PDF/Excel ingestion
Extraction
Matching
Validation
Planner review
Audit
Dashboard
Deployment

P1
Redis
OCR
Voice
PMIS adapter

P2
Offline mobile
Advanced analytics
Institutional memory search
Forecasting
HA/DR
gRPC/Tonic/Prost internal RPC (post-MVP only)
```

---

# 47. Recommended Engineering Sequence

```text
1. Monorepo
2. Docker Compose (PostgreSQL/pgvector, Redis, RabbitMQ)
3. RabbitMQ queue/exchange setup (ai_processing_queue, ai_result_queue, retry, DLQ)
4. PostgreSQL schema (work_observations, match_proposals, actual_events, approvals, audit_events)
5. Synthetic schedule
6. Rust API
7. Supabase Storage integration
8. PDF parser
9. Excel parser
10. Canonical observation model
11. AI extraction
12. Normalization
13. Embeddings (sentence-transformers/all-MiniLM-L6-v2, 384-dim)
14. Hybrid matcher
15. Rust validation
16. Event ledger
17. Planner UI
18. Audit
19. Dashboard
20. Redis
21. Deployment
22. Demo hardening
```

---

# 48. Definition of Done

```text
[ ] Schedule imported
[ ] PDF processed
[ ] Excel processed
[ ] Canonical observations created
[ ] Events extracted
[ ] Terminology normalized
[ ] Vector search works
[ ] Hybrid matching works
[ ] Confidence displayed
[ ] Evidence displayed
[ ] Planner review works
[ ] Rust state validation works
[ ] Event ledger works
[ ] Audit works
[ ] Dashboard works
[ ] Schedule export works
[ ] Public demo works
[ ] Failure scenarios tested
[ ] Golden dataset evaluated
[ ] No live confidential data used
[ ] Secrets excluded from repository
```

---

# 49. Final System Design Principle

NEXORA AI should be engineered as a **trusted execution-intelligence platform**, not as an LLM chatbot.

```text
MESSY FIELD DATA
       ↓
SANITIZE
       ↓
EXTRACT
       ↓
NORMALIZE
       ↓
RETRIEVE
       ↓
MATCH
       ↓
PROPOSE
       ↓
VALIDATE
       ↓
APPROVE
       ↓
COMMIT
       ↓
AUDIT
       ↓
INTEGRATE
       ↓
LEARN
```

The architecture deliberately assumes:

```text
Field data can be incomplete.
Reports can conflict.
AI can be wrong.
Users can retry.
Networks can fail.
Schedules can change.
Projects can contain sensitive information.
```

Therefore the system must be:

```text
Evidence-first
Confidence-aware
Human-governed
Idempotent
Versioned
Auditable
Project-isolated
Failure-tolerant
Vendor-neutral
```

**End of TRD.**
