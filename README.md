# NEXORA AI

Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management: Real-Time Actual Progress Tracking (Planning-to-Execution Bridge)

NEXORA AI is an evidence-driven platform that converts fragmented field execution data into structured, auditable actual-progress events for infrastructure projects. It bridges the gap between site reality and the authoritative L5/L6 baseline schedule used by planners, engineers, and project managers.

## Team Kasukabe

- Sirwagya Shekhar — Team Leader
- Shravanee Yadav
- Urvashi Pali
- Avika Mishra
- Aditya Shende
- Divyanshi Mewara

---

## Project summary

Infrastructure projects operate across multiple engineering disciplines — civil, piping, static and rotating equipment, electrical, instrumentation, and HSE — each generating work updates in parallel. The project schedule is usually formal and structured, but actual execution data is captured through daily reports, site diaries, discipline-wise spreadsheets, photographed evidence, scanned documents, and verbal updates. These inputs are inconsistent, delayed, and often documented in different terminology from the schedule itself.

NEXORA AI solves this by:

- ingesting heterogeneous field inputs,
- extracting actual execution evidence,
- normalizing discipline-specific language,
- matching observations to the correct L5/L6 schedule activity,
- assigning confidence scores and evidence,
- routing uncertain cases to human review,
- preserving a trusted audit trail before schedule state is modified.

The core trust model is:

AI proposes → Rust validates → Human approves when required → PostgreSQL records → Audit proves.

---

## Problem statement (SIH)

### Problem Statement Title

Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management: Real-Time Actual Progress Tracking (Planning-to-Execution Bridge)

### Description

- Background: Infrastructure project schedules cascade from macro milestones (L1) down to micro, executable activities (L5/L6), spanning multiple engineering disciplines — civil, piping, static/rotating equipment, electrical, instrumentation, HSE — each executing and reporting in parallel. While the baseline plan is well-structured (Primavera/MS Project), actual execution data flows back through daily progress reports, site diaries, discipline-wise spreadsheets, and verbal supervisor updates, each in its own format and cadence, largely disconnected from the L5/L6 activity IDs in the plan.

- Problem Description: There is no reliable, low-friction mechanism to capture actual start/end times of L5/L6 activities across disciplines and auto-link them back to the plan. Input quality varies with manpower skill, reporting discipline, and format. Field execution is often more granular than the planned WBS, and different disciplines describe the same physical progress differently (for example, “spool erected” versus the plan’s “Erect Line 24-XX”). Consequently:

  - Actual progress data is fragmented, delayed, and inconsistently structured across disciplines and contractors.
  - Manual reconciliation with the baseline schedule is slow, error-prone, and often lags the schedule update cycle by days or weeks.
  - Downstream performance analytics, delay/risk analysis, and forecasting inherit this poor-quality, late data, undermining the AI performance-monitoring stack that depends on it.
  - Once a project closes, the hard-won knowledge of what actually happened — real durations, real bottlenecks, real deviations from plan — is rarely captured in a structured, queryable form, so it is lost rather than feeding future project planning.

- Expected Outcome / Solution:
  - Ingest heterogeneous discipline-wise inputs — free-text daily reports, spreadsheets, scanned diaries, Primavera/MS Project exports — and extract activity-level actual start/end events.
  - Offer an LLM-based conversational or voice interface (“time agent”) for site supervisors across disciplines to log activity start/end with minimal friction, replacing rigid manual forms while still producing structured output.
  - Fuzzy-match and link extracted discipline-specific activity descriptions to the correct L5/L6 plan node, handling terminology differences and granularity mismatches, and flag unmatched/new activities for planner review rather than silently dropping them.
  - Auto-update actual start/end dates in the schedule/PMIS in near real time, with a confidence score and audit trail per entry.
  - Produce a clean, structured, discipline-tagged actual-progress dataset that serves two purposes: (a) live input for performance analytics, delay/risk pattern discovery, and forecasting, and (b) a foundation for institutional memory building — a growing, queryable repository of real project execution patterns (actual durations, recurring delay causes, discipline-wise productivity) that future projects can learn from, instead of that knowledge staying locked in individual supervisors’ experience or scattered paper records.

A working prototype demonstrating ingestion of 2–3 varied input formats (for example, a free-text daily report and a discipline spreadsheet), extraction, and schedule-linking logic would be ideal; full production-grade OCR/ASR is not required.

### Relevant Data Availability

Anonymized/sample daily progress report formats, sample L5/L6 schedule extracts, and illustrative discipline-wise (civil/piping/electrical) site-diary or spreadsheet templates can be shared under NDA with the Institute or authorized person. Live project data will not be shared; teams should work with synthetic/sample data of similar structure.

---

## What NEXORA AI does in simple terms

NEXORA AI acts like a planning-to-execution intelligence layer.

It reads what happened on site from messy project documents and observations, interprets the work in a consistent way, identifies which schedule activity it belongs to, and puts that information into a trusted review and approval workflow before it can influence official project progress.

In plain English:

- a supervisor says, “Piping erected the 24-inch line at Rack B”
- the system extracts the actual work and date
- it finds the matching L5/L6 schedule activity
- it checks confidence and governance rules
- a planner reviews only the uncertain cases
- approved updates become structured, auditable progress records

This saves hours of manual schedule reconciliation and gives project teams a faster and more reliable progress picture.

---

## Why this project matters

Infrastructure projects fail not because schedules are missing, but because the link between execution reality and schedule reality is weak.

Without a reliable bridge:

- progress is updated late,
- actual dates are inconsistent,
- activity mapping is manual and subjective,
- delay analysis is less trustworthy,
- lessons from past projects are not captured systematically.

NEXORA AI addresses that gap by creating a trusted and structured actual-progress layer that supports better planning, forecasting, governance, and institutional learning.

---

## Product vision

Build a trusted digital layer that turns field execution evidence into structured, traceable, near-real-time project progress intelligence.

Long-term impact:

- field reality captured quickly and consistently,
- actual progress linked to schedule activities,
- delay and risk patterns exposed earlier,
- governance and auditability built in,
- organizational memory preserved for future projects.

---

## Core capabilities

### 1. Heterogeneous ingestion
Supports input from:

- PDF progress reports
- Excel spreadsheets
- text and notes
- scanned diaries and forms
- images and field documentation
- voice and conversational updates

### 2. Evidence extraction
Identifies activity-level facts such as:

- actual start date
- actual finish date
- progress completion
- delays and blockers
- location, equipment, and discipline context

### 3. Terminology normalization
Field reports often use different language from the plan. The system normalizes terms such as:

- spool erected / spool installed / spool mounted
- line completed / line closed / line handed over
- activity progress / execution status / physical completion

so that the same work is matched consistently.

### 4. Semantic and fuzzy schedule matching
Observations are linked to L5/L6 activities using:

- lexical similarity
- semantic embeddings
- discipline-aware context
- schedule metadata (WBS, location, equipment, activity description)

### 5. Confidence and governance
Each proposed match carries:

- confidence score
- evidence references
- alternatives when uncertain
- approval state and audit record

### 6. Trusted state transitions
The AI layer never directly edits authoritative schedule state. A Rust validation layer enforces business rules and approval logic before an event is committed.

### 7. Auditability and institutional memory
Every observation, match, and accepted event is recorded so project teams can explain and defend what changed, when it changed, and why.

---

## System overview

```text
Users / Site Supervisors / Planners
                ↓
        React + TypeScript Frontend
                ↓
         Rust Trust Layer / API
   ├── Authentication and RBAC
   ├── Validation and business rules
   ├── State machine enforcement
   ├── Approval workflow
   ├── Audit logging
   └── Persistence to PostgreSQL
                ↓
        PostgreSQL + pgvector
   ├── Schedule metadata
   ├── Work observations
   ├── Match proposals
   ├── Actual events
   ├── Approvals
   └── Audit events
                ↓
        Python AI Processing Layer
   ├── Document extraction
   ├── OCR / ASR support
   ├── Normalization and enrichment
   ├── Embeddings generation
   ├── Candidate retrieval
   ├── Hybrid matching
   └── Confidence scoring
                ↓
          RabbitMQ Async Jobs
                ↓
      Supabase Storage / Object Storage
```

### Architecture map

```mermaid
flowchart LR
    A[Site Supervisor / Planner] --> B[Frontend Web App]
    B --> C[Rust Trust Layer]
    C --> D[(PostgreSQL + pgvector)]
    C --> E[RabbitMQ Queue]
    E --> F[Python AI Service]
    F --> G[Extracted Observations]
    G --> H[Semantic Matching]
    H --> I[Match Proposals]
    I --> C
    C --> J[Review Queue / Approval]
    J --> K[Approved Actual Events]
    K --> L[Audit Ledger]
    K --> M[Project Analytics & Forecasting]
```

---

## Standard application flow

1. A user uploads a daily progress report, spreadsheet, or observation.
2. The Rust backend receives the file and creates an internal record.
3. Evidence is stored in Supabase Storage or an equivalent object store.
4. A job is queued for AI processing.
5. Python extracts text, structured facts, and relevant metadata.
6. Work observations are normalized and enriched.
7. Candidate activities are retrieved from the schedule context.
8. Hybrid lexical + semantic matching proposes likely schedule links.
9. Rust validates the proposal against domain rules and confidence thresholds.
10. High-confidence events can be auto-linked.
11. Ambiguous matches are forwarded to planner review.
12. Approved updates are committed and logged in the audit ledger.

---

## User personas

### Site supervisor
Needs a lightweight way to record actual progress without manual schedule forms.

### Discipline engineer
Needs accurate field status mapped to the correct activity and location.

### Planner / scheduler
Needs a clean review workflow with candidate matches, evidence, and confidence estimates.

### Project manager
Needs reliable near-real-time actual progress to support decision-making and reporting.

### Auditor / governance stakeholder
Needs verifiable traceability and evidence for every schedule-linked decision.

---

## Demo acceptance criteria

The working prototype should demonstrate:

- upload of a daily progress report,
- ingestion of a discipline spreadsheet,
- extraction of actual work observations,
- normalization of naming variations,
- matching to the correct L5/L6 activity,
- display of confidence and candidate alternatives,
- evidence-backed review of each match,
- auto-linking of high-confidence events,
- planner review for uncertain mappings,
- reject invalid events,
- persist approved events and audit records,
- show project metrics updated from actual progress.

---

## Technology stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS

### Core backend
- Rust
- Axum
- Tokio
- SQLx
- Serde
- Tracing

### AI processing layer
- Python
- FastAPI
- Pydantic v2
- Polars / Pandas
- PyMuPDF
- openpyxl
- RapidFuzz
- spaCy
- sentence-transformers/all-MiniLM-L6-v2

### Data and infrastructure
- PostgreSQL
- pgvector
- Redis
- RabbitMQ
- Supabase Storage
- Docker / Docker Compose

---

## Locked MVP decisions

The MVP is intentionally constrained to a safer, demonstrable baseline:

- Storage: Supabase Storage only for the MVP
- Queue: RabbitMQ required for MVP processing
- Service communication: REST/JSON between Rust and Python
- Database naming: `work_observations`, `match_proposals`, `actual_events`, `approvals`, `audit_events`
- Event lifecycle: `PROPOSED → MATCHED → REVIEW_REQUIRED → APPROVED → COMMITTED`
- Verification status: `UNVERIFIED`, `SYSTEM_VERIFIED`, `HUMAN_VERIFIED`
- Embedding model: `sentence-transformers/all-MiniLM-L6-v2` (384-dim)
- Architecture flow: one authoritative process governs the whole build

---

## Repository structure

```text
nexora-ai/
├── README.md
├── PRD.md
├── TRD.md
├── Application_Flow.md
├── Backend_Schema.md
├── Implementation_Plan.md
├── docker-compose.yml
├── database/
│   ├── migrations/
│   └── seeds/
├── ai_service/
│   ├── app/
│   ├── tests/
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── requirements.txt
├── backend/
│   ├── src/
│   ├── tests/
│   └── Cargo.toml
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   └── e2e/
└── package.json
```

---

## Project documentation

This repository contains the design and technical baseline for the solution:

- [PRD.md](PRD.md) — product requirements and MVP scope
- [TRD.md](TRD.md) — technical architecture and locked requirements
- [Application_Flow.md](Application_Flow.md) — workflow diagrams and system stages
- [Backend_Schema.md](Backend_Schema.md) — database model and domain schema
- [Implementation_Plan.md](Implementation_Plan.md) — milestone plan and build sequence

---

## What is already in place

- Product and technical requirements documented in the design files
- Docker Compose orchestration for Postgres, Redis, RabbitMQ, AI service, Rust backend, and frontend
- Python AI service skeleton with environment-based configuration
- Rust backend skeleton and startup wiring
- React frontend shell and page structure
- Commitment to a trust-layer architecture with review and auditability built in

---

## What is still left to make the project complete

### 1. Environment configuration and secrets

Before the project can run with real data, the following must be configured:

- Supabase project URL and keys
- Supabase service role key for backend/admin workflows
- PostgreSQL connection string
- RabbitMQ credentials and queue configuration
- Redis connection string
- JWT or auth signing secret
- optional AI provider keys if production-grade OCR/ASR or LLM features are added

Example required environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexora
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=replace-with-a-secure-random-secret
AI_SERVICE_URL=http://localhost:8000
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Additional requirements:

- `.env.example` template committed to the repo
- `.env` excluded from version control
- separate secrets for dev, staging, and production

### 2. Database completion

The repository documents the schema and naming conventions, but full implementation still needs:

- migration files for all core tables and indexes
- actual PostgreSQL schema for `work_observations`, `match_proposals`, `actual_events`, `approvals`, and `audit_events`
- `pgvector` setup and embedding dimension configuration
- constraints, foreign keys, and validation logic
- RLS policies and role-based access
- seed data for demo projects
- backup and restore procedures

### 3. Rust trust layer

The trust plane still needs completion:

- authentication and identity verification
- RBAC by project and role
- state machine enforcement for accepted lifecycle transitions
- approval and rejection flows
- audit event logging for every AI-generated action
- duplicate detection and idempotency checks
- rule-based validation before a commit occurs

### 4. Python AI processing layer

The AI service still needs full implementation for:

- document ingestion and parsing
- PDF, spreadsheet, and image extraction
- OCR and ASR support where relevant
- normalization of discipline-specific terminology
- embedding generation for schedule matching
- candidate retrieval and hybrid scoring
- match proposal generation
- queue worker integration with RabbitMQ
- error recovery, retries, and DLQ handling

### 5. Frontend experience

The frontend shell exists, but the user-facing application still needs:

- upload page for evidence files
- project dashboard with KPI cards
- document review screens
- match review queue with evidence details
- planner approval interface
- audit trail viewer
- schedule export and reporting views
- complete API integration

### 6. Testing and validation

The project still needs:

- unit tests for Rust logic and lifecycle state transitions
- Python tests for extraction and matching
- integration tests for the full document → AI → trust-layer → database flow
- golden dataset tests against known schedule matches
- performance tuning for matching confidence thresholds

### 7. Deployment and operations

The application is not yet deployment-ready. Required items include:

- production Docker builds and health checks
- environment-specific configuration
- deployment target selection
- domain name and HTTPS setup
- monitoring, logging, and alerting
- database backup strategy
- storage configuration for project evidence files
- CI/CD pipeline for automated validation and deployment
- rollback process and operational runbooks

### 8. Security, governance, and compliance

Before “real-world” usage, the project should include:

- secret management via environment variables or a vault solution
- RBAC for planners, project managers, and auditors
- audit retention policies
- project data access controls
- legal/license review before external deployment
- protection against invalid schedule changes and unauthorized access

---

## Recommended production readiness checklist

- [ ] Required API keys and secrets are documented and securely managed
- [ ] Local dev environment works via Docker Compose
- [ ] Database migrations are complete and tested
- [ ] Trust layer validates all lifecycle transitions correctly
- [ ] AI ingestion and matching pipeline is end-to-end working
- [ ] Frontend review and approval flows are functional
- [ ] Audit trail is complete and tamper-aware
- [ ] Demo data is seeded and reproducible
- [ ] Deployment target is configured with TLS and monitoring
- [ ] Security and RBAC review is complete
- [ ] Code review passes before merge to main

---

## Code review requirement

Before merging changes or treating the project as production-ready, the repository should be reviewed using the project code review MCP workflow. This is especially important for:

- authentication and access control,
- database schema and migration changes,
- AI retrieval and matching logic,
- queue behavior and job reliability,
- deployment configuration and secrets handling,
- state machine and approval logic.

The code review MCP helps catch architecture, validation, and operational risks before the project is promoted beyond prototype status.

---

## Current status

This repository is best described as a strong prototype foundation and architecture blueprint rather than a fully completed application. The project includes the design documents, service skeletons, and deployment scaffolding needed for a realistic MVP, but real end-to-end working flows still need to be implemented, tested, and hardened.

---

## License

This project is licensed under the MIT License.

See the [LICENSE](LICENSE) file for the full text.

The MIT license allows reuse, modification, and distribution with attribution, making it a practical choice for a prototype project and a clean base for future extension or team collaboration.
