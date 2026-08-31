# NEXORA AI — Backend Schema, Application Flow & Implementation Plan

**Project:** Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management  
**Prototype platform:** Supabase + Rust + Python + React  
**Purpose:** SIH prototype with a clean path to government/PSU production

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
# 23. Application Flow — Standard Document

```text
1. User uploads PDF
        ↓
2. Rust creates document record
        ↓
3. File stored in Supabase Storage
        ↓
4. Processing job created
        ↓
5. Python reads document
        ↓
6. PDF text extracted
        ↓
7. AI extracts observations
        ↓
8. Python normalizes observations
        ↓
9. Embeddings generated
        ↓
10. Candidate activities retrieved
        ↓
11. Hybrid matcher creates proposals
        ↓
12. Rust receives proposals
        ↓
13. Rust validates proposal
        ↓
14. Confidence policy applied
        |
        +--- High → Auto-link
        |
        +--- Medium → Planner Review
        |
        +--- Low → Unmatched
        ↓
15. Actual event created
        ↓
16. Audit event created
        ↓
17. Current state updated
        ↓
18. Outbox event created
        ↓
19. Schedule/PMIS integration
```

---
# 24. Application Flow — Excel

```text
Excel Upload
    ↓
Rust API
    ↓
Supabase Storage
    ↓
Python
    ↓
openpyxl / Polars
    ↓
Column Mapping
    ↓
Canonical Observation
    ↓
Matching
    ↓
Rust Validation
    ↓
Event
```

The column mapping should support:

```text
Project-specific aliases
Activity ID
Line No
Equipment
Location
Status
Progress
Remarks
```

---
# 25. Application Flow — Voice

```text
Supervisor
    ↓
Browser microphone
    ↓
Speech-to-text
    ↓
Transcript
    ↓
Python extraction
    ↓
Observation
    ↓
Match
    ↓
Rust
    ↓
Confirmation
    ↓
Event
```

Example:

```text
Supervisor:
"Piping completed erection of
P one zero one at Rack B yesterday."

AI:
"Matched PIP-2401 with 94% confidence.
Mark actual finish as 28-Aug-2026?"

Supervisor:
"Yes."

Rust:
Validate
 ↓
Commit
```

---
# 26. Application Flow — Planner Review

```text
Pending Match
      ↓
Planner opens review
      ↓
System displays:
      |
      +-- source text
      +-- evidence
      +-- extracted facts
      +-- top candidates
      +-- score breakdown
      +-- project context
      |
      v
Planner decision
      |
 +----+--------+------+
 |             |      |
Approve      Correct Reject
 |             |      |
 +-------------+------+
               |
               v
          Rust validation
               |
               v
           Event ledger
```

---
# 27. Application Flow — Conflict

```text
Source A
"Completed 27 Aug"

Source B
"Completed 28 Aug"

        ↓

Conflict detector
        ↓
CONFLICTING_EVIDENCE
        ↓
Planner Review
        ↓
Resolution
        ↓
Audit
```

Do not silently overwrite one source with the other.

---
# 28. Application Flow — Late Report

```text
Report uploaded:
30-Aug

Report states:
"Work started 26-Aug"

        ↓

event_time   = 26-Aug
recorded_at  = 30-Aug

        ↓

Historical event remains accurate
```

This is why the system should distinguish:

```text
event_time
recorded_at
```

---
# 29. Application Flow — Duplicate

```text
Supervisor report
        |
        v
Event Proposal
        |
        v
Idempotency / Duplicate Detection
        |
   +----+----+
   |         |
Existing   New
   |         |
   v         v
Merge      Create
evidence   event
```

Multiple pieces of evidence can strengthen one event instead of generating duplicates.

---
# 30. Application Flow — PMIS Failure

```text
Event committed
      ↓
Outbox created
      ↓
PMIS worker
      ↓
External update fails
      ↓
Retry
      ↓
Retry
      ↓
Dead-letter / manual intervention
```

The actual event must not disappear merely because PMIS is unavailable.

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
