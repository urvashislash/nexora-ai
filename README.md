# NEXORA AI

Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management.

NEXORA AI is an evidence-driven platform that turns fragmented field execution data into structured, auditable actual-progress events for infrastructure projects. It connects messy site reality to the authoritative L5/L6 baseline schedule used by planners, discipline engineers, and project managers.

## Why this project exists

Infrastructure projects generate progress evidence through multiple channels: daily PDFs, discipline spreadsheets, site diaries, scanned documents, image uploads, and verbal updates. The schedule itself is formal and structured, but the execution information is fragmented, delayed, and often described in different terminology.

NEXORA AI solves that mismatch by:

- ingesting heterogeneous field inputs,
- extracting activity-level execution evidence,
- normalizing discipline-specific language,
- matching observations to the correct schedule activity,
- assigning confidence and evidence for every match,
- routing ambiguous cases to human review,
- preserving a full audit trail before any official schedule state is changed.

The core trust model is:

AI proposes → Rust validates → Human approves when required → PostgreSQL records → Audit proves.

---

## Product vision

Build a trusted digital layer that converts field execution evidence into schedule-linked project truth.

The long-term outcome is a live, traceable, near-real-time view of actual progress that helps teams manage delays, forecast outcomes, and improve project control across civil, piping, mechanical, electrical, and instrumentation workstreams.

---

## Primary use case

A planner or project manager uploads a daily progress report, discipline spreadsheet, or field observation and receives:

- extracted actual events,
- candidate schedule matches,
- confidence scores,
- source evidence,
- review queues for uncertain mappings,
- a clean audit record of what was accepted or rejected.

This reduces manual effort and improves the reliability of progress reconciliation.

---

## Core capabilities

### 1. Heterogeneous ingestion
Supports evidence from:

- PDF reports
- Excel and spreadsheet data
- text updates
- scanned images
- voice-based supervisor input
- field observations

### 2. Evidence extraction
The system identifies activity-level facts such as:

- actual start dates
- actual finish dates
- progress completion
- delays and blockers
- location and equipment context

### 3. Terminology normalization
Field reports may describe work using different terminology than the formal schedule. NEXORA AI normalizes these differences so a planner can reliably map real-world progress to the correct schedule activity.

### 4. Semantic schedule matching
Observations are compared against L5/L6 schedule activities using embeddings and lexical matching, enabling better candidate retrieval and higher-quality match proposals.

### 5. Confidence and governance
Each match carries confidence, explanation, and evidence so planners can review unclear cases without losing traceability.

### 6. Trusted state transitions
The AI layer never directly changes authoritative schedule state. A Rust validation layer enforces business rules and approval logic before events are committed.

### 7. Auditability
Every observation, match, approval, rejection, and state transition is preserved in an audit ledger for review and compliance.

---

## Locked MVP decisions

The MVP is intentionally constrained to a safer, demonstrable implementation baseline:

- Storage: Supabase Storage only for the MVP
- Queue: RabbitMQ required for MVP processing
- Service communication: REST/JSON between Rust and Python
- Database naming: work_observations, match_proposals, actual_events, approvals, audit_events
- Event lifecycle: PROPOSED → MATCHED → REVIEW_REQUIRED → APPROVED → COMMITTED
- Verification status: UNVERIFIED, SYSTEM_VERIFIED, HUMAN_VERIFIED
- Embedding model: sentence-transformers/all-MiniLM-L6-v2 (384-dim)
- Architecture flow: one authoritative process governs the whole build

---

## Target users

- Site supervisors
- Discipline engineers
- Planners and schedulers
- Project managers
- Auditors and governance stakeholders

---

## System overview

```text
Users
  ↓
React / TypeScript frontend
  ↓
Rust trust layer
  ├── Auth and RBAC
  ├── Validation
  ├── State machine
  ├── Approval workflow
  ├── Audit logging
  └── Event persistence
  ↓
PostgreSQL + pgvector
  ↓
Python AI processing layer
  ├── Extraction
  ├── OCR / ASR
  ├── NLP
  ├── Embeddings
  ├── Hybrid matching
  └── Match proposal generation
  ↓
RabbitMQ for async jobs
  ↓
Supabase Storage for evidence files
```

---

## Standard application flow

1. A user uploads source evidence.
2. Rust creates a document or observation record.
3. The file is stored in Supabase Storage.
4. A processing job is queued.
5. Python extracts text or structured data from the source.
6. Observations are normalized and enriched.
7. Schedule activities are retrieved for candidate matching.
8. Matching generates one or more proposals.
9. Rust validates the proposal against business rules.
10. High-confidence matches are auto-linked.
11. Ambiguous results are routed to planner review.
12. Approved events are committed and audited.

---

## Technology stack

### Frontend
- React
- TypeScript
- Tailwind CSS

### Core backend
- Rust
- Axum
- Tokio
- SQLx
- Serde
- Tracing

### AI and processing layer
- Python
- FastAPI
- Pydantic v2
- Polars / Pandas
- PyMuPDF
- openpyxl
- spaCy
- RapidFuzz
- sentence-transformers/all-MiniLM-L6-v2

### Data and infrastructure
- PostgreSQL
- pgvector
- Redis
- RabbitMQ
- Supabase Storage
- Docker / Docker Compose

---

## Data model principles

The platform is centered on a trusted event ledger. It explicitly separates:

- schedule data,
- field observations,
- match proposals,
- actual events,
- approvals,
- audit records.

This preserves a clear distinction between raw evidence, AI-generated suggestions, and verified project truth.

---

## Key project outcomes

NEXORA AI is designed to deliver:

- faster reconciliation between field reality and the project schedule,
- more transparent actual-progress reporting,
- reduced manual planner effort,
- better delay visibility and progress analysis,
- auditable traceability for every schedule-linked event,
- a practical, production-oriented SIH demo with governance value.

---

## Demo acceptance criteria

The prototype should show that it can:

- upload a daily progress report,
- ingest a discipline spreadsheet,
- extract actual field observations,
- normalize terminology,
- match to the proper L5/L6 activity,
- show confidence and candidate alternatives,
- present evidence for each match,
- auto-link high-confidence events,
- route uncertain cases to planner review,
- reject invalid events,
- persist official event data,
- generate audit records,
- update project metrics,
- export or project schedule-linked outputs.

---

## Project documentation

This repository contains the design and technical baseline for the solution:

- [PRD.md](PRD.md) — product requirements and MVP scope
- [TRD.md](TRD.md) — technical architecture and locked requirements
- [Application_Flow.md](Application_Flow.md) — workflow diagrams and system stages
- [Backend_Schema.md](Backend_Schema.md) — database model and domain schema
- [Implementation_Plan.md](Implementation_Plan.md) — milestone plan and build sequence

---

## Repository status

This repository currently contains the design and technical baseline for the NEXORA AI prototype, rather than a completed end-to-end application implementation. The structure is intentionally aligned with a production-ready government/PSU architecture while remaining feasible for an SIH prototype.

---

## Suggested next steps

1. Create the monorepo structure for frontend, Rust, and Python services.
2. Set up Docker Compose for local orchestration.
3. Implement the PostgreSQL schema and migrations.
4. Build the Rust trust layer and authorization model.
5. Implement the Python extraction and matching pipeline.
6. Create the review dashboard and project workflows.
7. Validate the full demo flow with seeded project data.

---

## License

This project is currently intended for prototype and hackathon use. Add a production-appropriate license before public or commercial deployment.
