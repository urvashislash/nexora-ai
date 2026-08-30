# NEXORA AI — Developer Onboarding & Local Setup Guide

Welcome to the **NEXORA AI Command Centre** repository. This document provides a complete guide for engineers onboarding to the platform, including environment prerequisites, multi-service local startup, configuration reference, and troubleshooting procedures.

---

## 1. System Architecture Overview

NEXORA AI is an industrial-grade infrastructure project intelligence and schedule reconciliation platform structured across three primary tiers:

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

## 2. Prerequisites & Tooling

Ensure the following tools are installed on your workstation:

| Component | Required Version | Verification Command |
|---|---|---|
| **Node.js & npm** | Node 20+ & npm 10+ | `node -v && npm -v` |
| **Rust Toolchain** | Rust 1.78+ (stable) | `rustc --version && cargo --version` |
| **Python & uv** | Python 3.11+ & uv | `python3 --version && uv --version` |
| **Supabase CLI** | 2.116.0+ | `npx supabase --version` |
| **cURL & OpenSSL** | Standard system tools | `curl --version && openssl version` |

---

## 3. Quick Start (Run in 3 Steps)

### Step 1: Clone and Configure Environment

```bash
git clone https://github.com/urvashislash/nexora-ai.git
cd nexora-ai

# Copy root configuration
cp .env.example .env

# Copy frontend configuration
cp frontend/.env.example frontend/.env
```

### Step 2: Link Supabase Cloud Database

To connect your local workspace with the remote Supabase PostgreSQL instance:

```bash
# Authenticate Supabase CLI (if first time)
npx supabase login

# Link remote project
./scripts/link_supabase.sh vitxgshrjpyvczidzvto production

# Deploy latest migrations
./scripts/deploy_to_supabase.sh
```

### Step 3: Launch Local Services

Open 3 separate terminal tabs (or run as background daemons):

#### Terminal 1 — Rust Backend API (Port 3000)
```bash
cd backend
cargo run
```
*Healthcheck:* `curl http://localhost:3000/api/v1/health`

#### Terminal 2 — Python AI Processing Service (Port 8000)
```bash
cd ai_service
# Setup virtual environment and dependencies using uv
uv venv
uv pip install -r requirements.txt

# Start FastAPI server
.venv/bin/uvicorn app.main:app --port 8000 --host 0.0.0.0
```
*Healthcheck:* `curl http://localhost:8000/health`

#### Terminal 3 — Frontend Web Console (Port 5173)
```bash
cd frontend
npm install
npm run dev
```
*Access Web Console:* [http://localhost:5173](http://localhost:5173)

---

## 4. Multi-Service Health Verification

To verify that all three local tiers and database connectivity are healthy simultaneously, run:

```bash
./scripts/health_probe.sh local
```

Expected Output:
```
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

## 5. Environment Variables Reference

### Root `.env`
```ini
# PostgreSQL (Supabase Cloud)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_supabase_db_password
POSTGRES_DB=postgres
POSTGRES_HOST=db.vitxgshrjpyvczidzvto.supabase.co
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/postgres

# Supabase Storage & Keys
SUPABASE_URL=https://vitxgshrjpyvczidzvto.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Message Queue & Cache
RABBITMQ_URL=amqp://guest:guest@localhost:5672/%2f
REDIS_URL=redis://localhost:6379/0

# Services
BACKEND_PORT=3000
AI_PORT=8000
```

### Frontend `frontend/.env`
```ini
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://vitxgshrjpyvczidzvto.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## 6. Helper CLI Scripts

The `scripts/` directory contains automation for routine tasks:

| Script | Purpose | Example |
|---|---|---|
| [`health_probe.sh`](file:///Users/sirwagyashekhar/Projects/nexora-ai/scripts/health_probe.sh) | Validates availability of all 3 services + DB | `./scripts/health_probe.sh local` |
| [`link_supabase.sh`](file:///Users/sirwagyashekhar/Projects/nexora-ai/scripts/link_supabase.sh) | Links workspace to cloud Supabase project | `./scripts/link_supabase.sh vitxgshrjpyvczidzvto` |
| [`deploy_to_supabase.sh`](file:///Users/sirwagyashekhar/Projects/nexora-ai/scripts/deploy_to_supabase.sh) | Pushes migrations to Supabase Cloud | `./scripts/deploy_to_supabase.sh` |
| [`backup_db.sh`](file:///Users/sirwagyashekhar/Projects/nexora-ai/scripts/backup_db.sh) | Takes automated PostgreSQL schema & data dump | `./scripts/backup_db.sh` |
| [`restore_db.sh`](file:///Users/sirwagyashekhar/Projects/nexora-ai/scripts/restore_db.sh) | Restores database from a verified dump | `./scripts/restore_db.sh backups/backup.dump` |
| [`rollback.sh`](file:///Users/sirwagyashekhar/Projects/nexora-ai/scripts/rollback.sh) | Rolls back application container deployments | `./scripts/rollback.sh` |

---

## 7. Troubleshooting Guide

### Issue 1: `Port 3000 / 8000 / 5173 is already in use`
**Cause**: A previous daemon or orphaned process is holding the port.
**Fix**:
```bash
# Find PID holding the port (e.g. 3000)
lsof -i :3000
# Terminate the process
kill -9 <PID>
```

### Issue 2: `Supabase CLI: Remote migration versions not found`
**Cause**: Migration timestamp ordering mismatch between local and remote database history.
**Fix**:
```bash
# Repair the migration history table
npx supabase migration repair --status reverted <VERSION_ID>
# Re-push migrations
./scripts/deploy_to_supabase.sh
```

### Issue 3: `Python AI Service: ModuleNotFoundError: No module named 'fastapi'`
**Cause**: The command is executing against global Python instead of the local virtual environment.
**Fix**:
```bash
cd ai_service
uv venv
uv pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000
```

### Issue 4: `Rust build error: could not find OpenSSL`
**Cause**: Missing `pkg-config` or `openssl` headers on macOS / Linux.
**Fix**:
```bash
# On macOS (Homebrew)
brew install openssl pkg-config
export OPENSSL_ROOT_DIR=$(brew --prefix openssl)
```
