# NEXORA AI — Intelligent Infrastructure Project Intelligence & Schedule-Linking Platform

**Real-Time Actual Progress Tracking & Planning-to-Execution Bridge**  
*Smart India Hackathon (SIH) — Hardware & Software Edition*

NEXORA AI is an industrial-grade project intelligence platform that converts unstructured, fragmented field execution evidence (daily site reports, subcontractor spreadsheets, voice logs, and inspection sheets) into structured, auditable actual-progress events for EPC infrastructure projects. It bridges the critical divide between field execution reality and authoritative L5/L6 baseline schedules (Oracle Primavera P6 / MS Project).

---

## 👥 Team Kasukabe

- **Sirwagya Shekhar** — Team Leader, Full-Stack Architecture & DevOps (Monorepo, Database & Supabase Cloud, React Field Ledger UI, Deployment & CI/CD)
- **Shravanee Yadav** — AI/ML Lead & Rust Backend Systems (Multi-Format Extraction, Semantic Embeddings, Queue Reliability, Rust Trust Plane & RBAC)
- **Urvashi Pali** — NLP Matching Engine & Integration Testing (Domain Normalization & Synonym Ontologies, Matcher Pipeline, End-to-End Integration Test Suite)
- **Divyanshi Mewara** — Security, QA & Planner UX (Security Hardening & Governance, Golden Dataset & Regression Test Suites, Planner Review Queue UX)
- **Aditya Shende** — Trust Plane & Cryptographic Ledger Engineer (Rust Axum Trust Plane, SHA-256 Audit Chain Integrity, State Machine Validation)
- **Avika Mishra** — Systems & Infrastructure Engineering

---

## 🏛️ Core Trust Architecture

NEXORA AI enforces a **zero-hallucination trust protocol**:

$$\text{AI Proposes} \longrightarrow \text{Rust Validates} \longrightarrow \text{Planner Approves} \longrightarrow \text{PostgreSQL Records} \longrightarrow \text{Audit Proves}$$

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NEXORA FRONTEND                                │
│                     (React 19 + TypeScript + Vite + Tailwind 4)             │
│                       Field Ledger UI — http://localhost:5173               │
└───────────────────────┬─────────────────────────────────────────────────────┘
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
┌──────────────────────────────┐ ┌───────────────────────────────────────────┐
│     RUST TRUST PLANE API     │ │         PYTHON AI PROCESSING PLANE        │
│   (Axum + Tokio + SHA-256)   │ │  (FastAPI + RapidFuzz + all-MiniLM-L6-v2) │
│    http://localhost:3000     │ │           http://localhost:8000           │
│   • Predecessor validation   │ │  • PDF/Audio/Spreadsheet extraction       │
│   • Monotonic progress rules │ │  • 384-dim semantic embedding search      │
│   • Cryptographic audit logs │ │  • Normalized entity parsing              │
└──────────────┬───────────────┘ └─────────────────────┬─────────────────────┘
               │                                       │
               └───────────────────┬───────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PERSISTENCE & STORAGE (SUPABASE CLOUD)                   │
│             PostgreSQL 16 + pgvector • Storage Bucket: evidence-documents   │
│                 Project: vitxgshrjpyvczidzvto.supabase.co                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Platform Capabilities

### 1. Heterogeneous Field Evidence Ingestion
- Ingests free-text daily progress logs, structured Excel/CSV inspection sheets, multi-page PDFs, and audio recordings into Supabase Storage (`evidence-documents`).
- Real-time 5-stage pipeline tracker visualizes parsing, extraction, embedding generation, trust verification, and ledger commitment.

### 2. Hybrid AI Schedule Matching Engine
- **Lexical Matching (40%)**: RapidFuzz token sort and partial string matching on activity codes, equipment tags, and line numbers.
- **Semantic Search (40%)**: 384-dimensional dense vector embeddings (`sentence-transformers/all-MiniLM-L6-v2`) with pgvector cosine similarity search.
- **Context Boost (20%)**: Spatial, discipline, and WBS path alignment bonuses.

### 3. Rust-Powered Zero-Hallucination Trust Plane
- Enforces strict topological dependency rules (predecessor completion requirements).
- Prevents impossible timeline anomalies (e.g., negative duration, progress rollback, finish date preceding start date).
- Deterministic state machine: `PROPOSED` &rarr; `MATCHED` &rarr; `REVIEW_REQUIRED` &rarr; `APPROVED` &rarr; `COMMITTED`.

### 4. High-Density Planner Review Console
- 3-column split view for human-in-the-loop review of ambiguous proposals.
- Score decomposition visualizer (Lexical, Semantic, Context).
- Single approve, batch approve, activity override selector, and rejection with mandatory engineering rationale.

### 5. Cryptographic SHA-256 Audit Trail
- Every state transition is cryptographically chained to the previous block's SHA-256 hash.
- Live verification action (`/api/v1/projects/:id/audit-trail/verify`) detects any unauthorized database tampering.
- Interactive before/after JSON diff inspection.

### 6. Oracle Primavera P6 Export & PMIS Sync
- One-click export to standardized Oracle Primavera P6 XML (`V24` schema).
- Real-time CSV schedule variance download and JSON PMIS sync payloads.

---

## ⚡ Quick Start (Local Setup)

### 1. Prerequisites
- **Node.js 20+** & **npm 10+**
- **Rust 1.78+** (`cargo`)
- **Python 3.11+** & **uv**
- **Supabase CLI** (`npx supabase`)

### 2. Clone and Configure Environment
```bash
git clone https://github.com/urvashislash/nexora-ai.git
cd nexora-ai

# Copy environment configurations
cp .env.example .env
cp frontend/.env.example frontend/.env
```

### 3. Start Local Services

Open 3 terminal sessions:

```bash
# Terminal 1: Rust Backend API (Port 3000)
cd backend
cargo run

# Terminal 2: Python AI Processing Service (Port 8000)
cd ai_service
uv venv && uv pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000 --host 0.0.0.0

# Terminal 3: React Frontend Console (Port 5173)
cd frontend
npm install
npm run dev
```

### 4. Verify System Health
Run the automated multi-service health probe:
```bash
./scripts/health_probe.sh local
```

Expected Output:
```text
=============================================================================
 NEXORA AI — System Health & Availability Probe [local]
=============================================================================
• Probing Rust Backend API (http://localhost:3000/api/v1/health)... ✅ HEALTHY
• Probing Python AI Service (http://localhost:8000/health)... ✅ HEALTHY
• Probing Frontend Web App (http://localhost:5173)... ✅ HEALTHY
• Probing Supabase / PostgreSQL Connection... ✅ CONNECTED
=============================================================================
🎉 System status: ALL PROBED SERVICES OPERATIONAL
```

---

## 🧪 Smart India Hackathon (SIH) Demo Scenarios

The platform includes 5 built-in demonstration scenarios located on the **Evidence Inbox** page:

| Scenario | Input Evidence | Expected Behavior |
|---|---|---|
| **Scenario A: Exact Match** | *"P-101 completed successfully. Hydro test pack holding pressure maintained at 42.5 bar for 4 hours."* | **>90% Auto-Link**: Matches `PIP-2401`. Rust Trust Plane commits 100% completion automatically. |
| **Scenario B: Semantic Match** | *"spool erection complete on Pipe Rack B Tier 2 with alignment and bolt tightening done."* | **Semantic Normalization**: 384-d embedding matches `PIP-2400` despite colloquial wording. |
| **Scenario C: Ambiguous Match** | *"Hydrostatic pressure testing completed along Interconnecting Pipe Rack B headers yesterday."* | **Planner Review Queue**: Matches both `PIP-2401` and `PIP-2402` (76% confidence). Routed to Planner Review. |
| **Scenario D: Unmatched Scope** | *"Emergency dewatering and deep foundation pit excavation carried out near Substation 4."* | **Unmatched Isolation**: Scope does not exist in baseline L5 schedule; isolated for scope adjustment without hallucinating. |
| **Scenario E: Date Inversion** | *"Line P-101 testing finished on 20-Aug-2026, work started on 28-Aug-2026."* | **Trust Plane Rejection**: Rejects impossible timeline (`finish < start`) with `VALIDATION_ERROR`. |

---

## 📁 Repository Structure

```text
nexora-ai/
├── backend/                         # Rust Axum Trust Plane
│   ├── src/
│   │   ├── api/                     # Route handlers & RBAC middleware
│   │   ├── domain/                  # Trust validation, state machine & SHA-256 ledger
│   │   └── main.rs                  # Axum HTTP server entry point
│   ├── Cargo.toml
│   └── Dockerfile
├── ai_service/                      # Python AI Extraction & Matching Plane
│   ├── app/
│   │   ├── api/                     # FastAPI extraction & matching endpoints
│   │   ├── services/                # Hybrid matcher, embeddings, document parser
│   │   ├── workers/                 # RabbitMQ background queue worker
│   │   └── main.py                  # FastAPI application entry point
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                        # React 19 Frontend (Field Ledger UI)
│   ├── src/
│   │   ├── components/              # ActivityDrawer, EvidenceDrawer, Sidebar
│   │   ├── pages/                   # Dashboard, Evidence, Review, Explorer, Audit, Export
│   │   ├── lib/                     # API client & Supabase Cloud connectors
│   │   └── App.tsx                  # Master application shell
│   ├── nginx.conf                   # Hardened production Nginx configuration
│   └── Dockerfile
├── database/                        # Database Schema & Migrations
│   ├── migrations/                  # 001 to 007 SQL migrations (PostgreSQL + pgvector)
│   └── seeds/                       # Demo refinery project seed data
├── scripts/                         # Operational & DevOps CLI Helpers
│   ├── health_probe.sh              # Multi-tier health probe
│   ├── link_supabase.sh             # Cloud database connector
│   ├── deploy_to_supabase.sh        # Migration deployment script
│   ├── backup_db.sh                 # Database backup utility
│   ├── restore_db.sh                # Database restore utility
│   └── rollback.sh                  # Emergency container rollback script
├── docs/                            # Comprehensive Technical Documentation
│   ├── specs/                       # PRD, TRD, Schema, Application Flow, UI & Implementation Plans
│   ├── developer_onboarding.md       # Local setup & troubleshooting guide
│   ├── product_overview_and_demo.md # Product architecture & SIH demo script
│   ├── support_and_operations_checklist.md # Production support & escalation
│   ├── project_readiness_checklist.md # Final release gate sign-off matrix
│   ├── monitoring_and_alerts.md     # SLIs, SLOs & alerting thresholds
│   ├── deployment_runbook.md        # Zero-downtime deployment procedure
│   ├── incident_runbook.md          # Disaster recovery runbook
│   ├── rbac_and_access_control.md   # Role-based access specifications
│   ├── secrets_management.md        # Vault & environment security
│   └── audit_retention_policy.md    # Cryptographic audit governance
├── docker-compose.yml               # Local orchestration
└── docker-compose.prod.yml          # Hardened production orchestration
```

---

## 📚 Technical Documentation Index

- **[SIH Judge Q&A & Interview Guide](docs/sih_judge_qa_guide.md)**: Master evaluation questions, plain-English answers, analogies, and defense tips for SIH jury rounds.
- **[100% Free-Tier Deployment Guide](docs/free_tier_deployment_guide.md)**: Zero-cost deployment blueprint (Vercel, Render, HF Spaces, Supabase, CloudAMQP, Upstash).
- **[Developer Onboarding Guide](docs/developer_onboarding.md)**: Local setup, environment configuration, and troubleshooting.
- **[Product Overview & Demo Guide](docs/product_overview_and_demo.md)**: End-to-end user flows and SIH demo walkthrough.
- **[Production Readiness Checklist](docs/project_readiness_checklist.md)**: Formal audit and release gate sign-off.
- **[Support & Operations Checklist](docs/support_and_operations_checklist.md)**: Routine maintenance, escalation matrix, and SLAs.
- **[Monitoring & Alerting Guide](docs/monitoring_and_alerts.md)**: Telemetry metrics, SLIs/SLOs, and alerting rules.
- **[Deployment Runbook](docs/deployment_runbook.md)**: Zero-downtime container and database deployment steps.
- **[Incident Response Runbook](docs/incident_runbook.md)**: Recovery protocols for queues, storage, and trust violations.
- **[RBAC & Access Control](docs/rbac_and_access_control.md)**: Project authorization and RLS governance.
- **[Secrets Management Guide](docs/secrets_management.md)**: Secure credential isolation policies.
- **[Audit Retention Policy](docs/audit_retention_policy.md)**: Cryptographic ledger retention and partitioning.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
