# NEXORA AI — Backend Schema, Application Flow & Implementation Plan

**Project:** Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management  
**Prototype platform:** Supabase + Rust + Python + React  
**Purpose:** SIH prototype with a clean path to government/PSU production

---
# 46. Testing Strategy

## Unit tests

Rust:

```text
state machine
authorization
validation
idempotency
date rules
```

Python:

```text
extraction
normalization
matching
scoring
```

## Integration test

```text
PDF
→ extraction
→ matching
→ Rust validation
→ PostgreSQL
→ dashboard
```

## Golden dataset

Create:

```text
50–100 field statements
```

with known expected activities.

Measure:

```text
Top-1 accuracy
Top-3 recall
auto-link precision
unmatched rate
review rate
```

---
# 47. Prototype Build Sequence

## Sprint 1 — Foundation

```text
1. Monorepo
2. Docker Compose
3. Supabase project
4. Database migrations
5. Rust Axum service
6. FastAPI service
7. React shell
```

Done when all services communicate.

---

## Sprint 2 — Schedule

```text
1. Schedule CSV/XLSX parser
2. WBS import
3. Activity import
4. Dependencies
5. Schedule versioning
6. Activity search
7. pgvector embeddings
```

Done when schedule can be imported and searched.

---

## Sprint 3 — Field Data

```text
1. PDF ingestion
2. Excel ingestion
3. Document metadata
4. Object storage
5. Extraction pipeline
6. Work observations
```

Done when heterogeneous inputs produce canonical observations.

---

## Sprint 4 — Matching

```text
1. Candidate retrieval
2. RapidFuzz
3. Embeddings
4. Semantic search
5. Hybrid scoring
6. Confidence policy
7. Match proposals
```

Done when the system reliably proposes L5/L6 matches.

---

## Sprint 5 — Trusted Core

```text
1. Rust validation
2. State machine
3. Duplicate detection
4. Approval
5. Event ledger
6. State projection
7. Audit
8. Idempotency
```

Done when AI cannot directly create invalid official state.

---

## Sprint 6 — Frontend

```text
1. Upload page
2. Processing status
3. Match review
4. Evidence viewer
5. Activity timeline
6. Dashboard
7. Schedule export
```

Done when the entire demo can be run without developer intervention.

---

## Sprint 7 — Deployment

```text
1. Production builds
2. Secrets
3. Database
4. Object storage
5. Rust API deployment
6. Python deployment
7. Frontend deployment
8. HTTPS
9. Monitoring
10. Demo seed/reset
```

Done when the judges can access the system through a public URL.

---
# 48. Recommended MVP Pages

```text
/login
/dashboard

/projects
/projects/:id

/documents
/documents/:id

/review
/review/:observation_id

/activities/:id

/events/:id

/audit/:entity_id

/settings
```

---
# 49. Dashboard KPIs

```text
Total field observations
Extracted events
Auto-linked events
Planner review queue
Unmatched observations
Completed activities
Delayed activities
Average matching confidence
```

Discipline view:

```text
Civil
Piping
Mechanical
Electrical
Instrumentation
HSE
```

---
# 50. SIH Demo Acceptance Criteria

The prototype must demonstrate:

```text
[ ] Upload daily report
[ ] Upload discipline spreadsheet
[ ] Extract activities/events
[ ] Normalize terminology
[ ] Match to L5/L6 activity
[ ] Show candidate alternatives
[ ] Show confidence score
[ ] Show evidence
[ ] Auto-link a high-confidence event
[ ] Route ambiguous event to planner
[ ] Reject invalid event
[ ] Store event
[ ] Create audit record
[ ] Update activity state
[ ] Show dashboard change
[ ] Export updated schedule
[ ] Demonstrate duplicate handling
[ ] Demonstrate conflicting evidence
```

---
# 51. Five Mandatory Demo Scenarios

## A — Exact Match

```text
"P-101 completed"
```

Expected:

```text
PIP-2401
High confidence
Auto-link
```

## B — Semantic Match

```text
"spool erection complete"
```

Expected:

```text
Correct L5/L6 activity
despite different wording
```

## C — Ambiguous

```text
two similar piping activities
```

Expected:

```text
Planner review
```

## D — Unmatched

```text
new work not present in schedule
```

Expected:

```text
Unmatched/new activity queue
```

## E — Invalid

```text
Finish date before start date
```

Expected:

```text
Rust rejects event
```

---
# 52. Deployment Plan

## Local

```text
Docker Compose
|
+-- Rust
+-- Python
+-- PostgreSQL/pgvector
+-- Redis
+-- RabbitMQ
+-- Supabase Storage (cloud; MVP-locked — no local object store needed)
```

## Public SIH prototype

```text
React
→ Cloudflare Pages

Rust/Axum
→ low-cost/free web host

PostgreSQL + pgvector
→ Supabase

Storage
→ Supabase Storage (locked for MVP)

Python/FastAPI
→ low-cost/free compute or controlled demo host

LLM
→ local/open-source or approved low-cost inference
```

The exact free-tier/provider availability should be checked immediately before deployment because provider pricing and free-tier limits can change.

---
# 53. Production Migration

The application should preserve the same interfaces while infrastructure changes.

```text
SIH (MVP — locked)
|
+-- Supabase PostgreSQL
+-- Supabase Storage
+-- Redis
+-- RabbitMQ
|
v
Government Pilot
|
+-- PostgreSQL in approved environment
+-- Approved object storage (e.g. self-hosted S3-compatible store — future migration)
+-- Redis/Valkey
+-- RabbitMQ/Kafka
+-- Internal AI model
|
v
Government Production
|
+-- HA PostgreSQL
+-- S3-compatible storage
+-- Redis/Valkey cluster
+-- RabbitMQ/Kafka as required
+-- Government IAM
+-- SIEM
+-- WAF
+-- DR
```

Supabase Storage is locked for the MVP. A self-hosted S3-compatible store (e.g. SeaweedFS, Ceph RGW) is a possible future migration target once the project moves beyond the SIH prototype — it is not part of the MVP build, and the application's storage interface should stay abstracted so that migration is a configuration change, not a rewrite.

---
# 54. Implementation Priority

If development time becomes constrained, prioritize:

```text
P0
RabbitMQ queue design (Section 9A)
Actual event extraction
Activity matching
Rust validation
PostgreSQL persistence
Planner review
Evidence
Supabase Storage integration

P1
Dashboard
Audit
Schedule export

P2
Redis
Voice
Offline mode

P3
Historical forecasting
Institutional memory
Full PMIS integration
gRPC/Tonic/Prost internal RPC (post-MVP only)
```

---
# 55. Final Backend Mental Model

```text
                UNTRUSTED WORLD
                     |
       PDF / Excel / Voice / Text
                     |
                     v
              PYTHON AI PLANE
                     |
          extraction / normalization
                     |
              match proposal
                     |
                     v
              RUST TRUST PLANE
                     |
     auth / validation / policy / state
                     |
          +----------+----------+
          |                     |
          v                     v
      HUMAN REVIEW          AUTO-LINK
          |                     |
          +----------+----------+
                     |
                     v
               EVENT LEDGER
                     |
           +---------+---------+
           |                   |
           v                   v
      CURRENT STATE         AUDIT
           |
           v
       OUTBOX EVENT
           |
           v
        PMIS/Export
```

---
# 56. Final Backend Rule Set

```text
1. PostgreSQL is the system of record.
2. Supabase provides the managed PostgreSQL/Auth/Storage platform for the prototype.
3. Redis is cache only.
4. Object storage retains original evidence.
5. Python produces proposals, not official schedule state.
6. Rust owns authorization and business rules.
7. Every AI event is evidence-linked.
8. Every official event is auditable.
9. Every write is idempotent where appropriate.
10. Schedule versions are immutable historical context.
11. Activity lineage handles schedule restructuring.
12. Conflicting evidence is surfaced, not silently resolved.
13. Late reports distinguish event time from recording time.
14. AI/model versions are recorded.
15. Project scope is enforced server-side and in retrieval queries.
16. PMIS synchronization uses an outbox.
17. Redis failure must not lose data.
18. AI failure must not destroy manual reporting capability.
19. Low-confidence matches never disappear silently.
20. The prototype must remain deployable at minimal cost and portable to government infrastructure.
21. RabbitMQ is required MVP infrastructure with a defined queue/retry/DLQ design (Section 9A) — not an optional later add-on.
22. Storage is Supabase Storage for the MVP; S3-compatible self-hosted storage is a documented future migration, not a current alternative.
23. Rust — never RLS alone — is the authorization boundary; RLS is defense-in-depth (Section 3A).
24. `lifecycle_status` and `verification_status` are the only status fields on `actual_events`; `AUTO_ACCEPTED` must never appear in code, schema, or seed data.
```

---
# 57. Final Target

The completed MVP should make this statement demonstrable:

> A supervisor can submit messy real-world execution information; NEXORA AI extracts the field fact, identifies the most likely L5/L6 schedule activity, explains the evidence and confidence, routes uncertainty to a planner, validates the approved event through a trusted Rust layer, records an immutable execution history, updates the current project state, and produces a structured data trail that can later power performance analytics and institutional project memory.
