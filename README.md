# NEXORA AI

**Construction evidence-to-schedule matching with planner review and an auditable trust-plane API.**

NEXORA AI helps EPC teams turn field reports, spreadsheets, images, and voice notes into normalized work observations and candidate schedule matches. The platform separates AI-assisted proposal generation from planner decisions and exposes audit, review, schedule, dependency, and export workflows in a React operations console.

> **Implementation status:** the Rust trust-plane API supports PostgreSQL persistence via connection pooling, Redis caching, RabbitMQ asynchronous event outbox relay, JWT Bearer authentication, schema-compliant Oracle Primavera P6 XML exports, and deterministic invariant validation. See [Trust plane and engine features](#trust-plane-and-engine-features) for details.

## Team Kasukabe

- Sirwagya Shekhar
- Shravanee Yadav
- Urvashi Pali
- Divyanshi Mewara
- Aditya Shende
- Avika Mishra

## What the app provides

- **Evidence intake:** text, PDF, image, CSV/XLS/XLSX/XLSM, and audio processing through the AI service.
- **Hybrid matching:** RapidFuzz lexical scoring, sentence-transformer embeddings when available, and construction context checks.
- **Planner review:** approve, reject, comment on, or override proposed activity matches.
- **Schedule workspace:** activity ledger, Gantt view, progress, variance, and dependency exploration.
- **Audit workspace:** SHA-256 chained in-memory audit events and chain verification.
- **Exports:** a basic P6-style XML export from the Rust API; the frontend also provides CSV exports.
- **Responsive UI:** mobile navigation, keyboard focus support, reduced visual density, and a persistent light/dark theme preference.

## Architecture and flow map

```mermaid
flowchart TD
    User[Planner or field team] --> UI[React 19 operations console]

    UI -->|Synchronous evidence processing| AI[FastAPI AI service]
    UI -->|Review, audit, activities, P6 export| Trust[Rust Axum trust-plane API]
    UI -->|Evidence object upload| Storage[Supabase Storage]

    AI -->|Publish document.process| MQ[RabbitMQ: nexora.jobs direct exchange]
    MQ --> Worker[Python AI worker]
    Worker -->|Lock, checkpoints, job result| Redis[Redis job-state store]
    Worker -->|Fetch queued object when supplied| Storage
    Worker -->|Extract, normalize, embed, match| Result[document.result]
    Result --> MQ
    MQ --> Trust

    Trust -->|Cache dashboard, activities, review queue| Redis
    Trust -->|Current runtime state and SHA-256 audit chain| Memory[In-memory AppState]

    DB[(PostgreSQL 16 + pgvector)]
    Storage --- DB
```

### RabbitMQ and Redis responsibilities

| Service | Current responsibility |
| --- | --- |
| **RabbitMQ** | Durable **direct** exchange (`nexora.jobs`) for async document jobs and results. It routes `document.process` to `ai_processing_queue`, `document.result` to `ai_result_queue`, retries to `ai_processing_retry_queue`, and failures to `ai_processing_dlq`. |
| **Redis** | AI-worker job locks, checkpoints, and seven-day job state; optional 15–60 second backend response caching for dashboard, activity, and review-queue data. |
| **PostgreSQL + pgvector** | Available in Docker Compose and migration assets, with optional PostgreSQL connection pooling integrated into the Rust backend via the `DATABASE_URL` environment variable. Database persistence layer is now available for domain state storage.
| **Supabase Storage** | Receives evidence uploads from the frontend. The async worker can retrieve queued objects when Supabase credentials and an object key are supplied. |

### Trust boundary

```text
Evidence → extract and normalize → candidate match → planner decision → audit event
```

The AI service produces observations and match proposals. The Rust API owns review actions and its current process-local audit chain. Do not interpret an AI match as a schedule update until a planner approval or application policy commits it.

## Repository layout

```text
nexora-ai/
├── frontend/                 # React 19 + TypeScript + Vite + Tailwind 4 console
│   ├── src/pages/            # Dashboard, evidence, review, schedule, audit, export
│   ├── src/components/       # Drawers, dialogs, navigation, shared UI primitives
│   └── public/favicon.svg    # Matches the NEXORA sidebar brand mark
├── backend/                  # Rust 2021 Axum trust-plane API
│   ├── src/api/              # Routes, handlers, header-based RBAC middleware
│   ├── src/domain/           # Models, validation utilities, state machine, SHA-256 ledger
│   ├── src/cache/            # Optional Redis response cache
│   └── src/messaging/        # RabbitMQ publisher, consumer, and outbox relay
├── ai_service/               # FastAPI extraction, matching, and async worker
│   ├── app/services/         # Parsers, OCR/ASR, embeddings, matcher, RabbitMQ publisher
│   └── app/workers/          # RabbitMQ worker and Redis-backed job state
├── database/                 # SQL migrations and demo seed data
├── scripts/                  # Supabase, database, backup, restore, and health helpers
├── docker-compose.yml        # Local stack: Postgres, RabbitMQ, Redis, AI, worker, API, UI
└── docker-compose.prod.yml   # Production-oriented Compose configuration
```

## Local development

### Prerequisites

- Node.js 20+ and npm
- Rust toolchain with Cargo
- Python 3.11+ and [`uv`](https://docs.astral.sh/uv/)
- Docker and Docker Compose for the complete asynchronous stack
- Optional for local media processing: Tesseract OCR and FFmpeg

### Run the full local stack

This is the recommended route when testing asynchronous evidence processing because it starts PostgreSQL/pgvector, RabbitMQ, Redis, the FastAPI service, its worker, the Rust API, and the frontend.

```bash
git clone https://github.com/urvashislash/nexora-ai.git
cd nexora-ai
docker compose up --build
```

Local service ports:

| Service | URL / port |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Rust API | `http://localhost:3000/api/v1/health` |
| AI service | `http://localhost:8000/health` |
| AI API docs | `http://localhost:8000/api/v1/docs` |
| RabbitMQ management | `http://localhost:15672` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

### Run services individually

```bash
# Frontend
cd frontend
npm install
npm run dev

# Rust API — optional RabbitMQ and Redis integration is enabled by exported URLs
cd ../backend
cargo run

# AI API (synchronous endpoints work without RabbitMQ)
cd ../ai_service
uv venv --python 3.11
uv pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

To run the AI worker outside Docker, start RabbitMQ and Redis first, then run:

```bash
cd ai_service
RABBITMQ_URL='amqp://guest:guest@localhost:5672/%2f' \
REDIS_URL='redis://localhost:6379/0' \
.venv/bin/python -m app.workers.queue_worker
```

The Rust service does not load a `.env` file itself. Supply `RABBITMQ_URL`, `REDIS_URL`, and `RUST_LOG` through the shell, Docker Compose, or deployment environment.

## Configuration

Never commit secrets. Use the supplied environment template as a reference and provide credentials through your local environment or deployment platform.

Important configuration groups:

| Area | Key variables |
| --- | --- |
| Rust API | `PORT` or `BACKEND_PORT`, `RABBITMQ_URL`, `REDIS_URL`, `RUST_LOG` |
| AI service | `AI_HOST`, `AI_PORT`, `RABBITMQ_URL`, `REDIS_URL`, `JOB_STATE_BACKEND` |
| Queue processing | `QUEUE_MAX_ATTEMPTS`, `QUEUE_RETRY_DELAY_MS`, `JOB_STATE_TTL_SECONDS`, `JOB_LOCK_TTL_SECONDS` |
| AI models | `EMBEDDING_MODEL`, `EMBEDDING_BACKEND`, `EMBEDDING_ALLOW_DOWNLOAD`, `ASR_MODEL` |
| Supabase Storage | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` |
| Database | `DATABASE_URL` for PostgreSQL connection |
| Security | `ALLOWED_ORIGINS` for CORS configuration (comma-separated list) |

The AI service defaults to `sentence-transformers/all-MiniLM-L6-v2` with 384 dimensions. With `EMBEDDING_BACKEND=auto` and downloads disabled, it uses a deterministic hash-vector fallback if the model is not already available.

## API overview

### Rust trust-plane API

All routes are under `/api/v1`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Process health plus RabbitMQ/Redis connection state |
| `GET` | `/projects/:id/dashboard` | Project KPI dashboard |
| `GET` | `/projects/:id/activities` | Project activities |
| `GET` | `/projects/:id/observations` | Observations held by the process |
| `GET` | `/projects/:id/review-queue` | Pending match proposals |
| `POST` | `/projects/:id/observations` | Create an observation |
| `POST` | `/projects/:id/ingest` | Ingest an observation |
| `POST` | `/proposals/:id/approve` | Approve a proposal |
| `POST` | `/proposals/:id/reject` | Reject a proposal |
| `POST` | `/proposals/:id/override` | Override a proposed target |
| `GET` | `/projects/:id/audit-trail` | Read audit events |
| `GET` | `/projects/:id/audit-trail/verify` | Verify the in-memory audit chain |
| `GET` | `/projects/:id/export/p6` | Generate basic P6-style XML |

Protected API routes use `X-User-Id` and `X-User-Role` headers in the current implementation. This is role-based request validation, **not** a complete JWT/session authentication system.

### AI processing API

The FastAPI router is mounted at `/api/v1`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | AI service process health |
| `GET` | `/api/v1/health` | Embedding, RabbitMQ, and Redis status |
| `POST` | `/api/v1/extract` | Extract observations from text |
| `POST` | `/api/v1/extract-file` | Extract from a multipart file |
| `POST` | `/api/v1/schedule/import-file` | Parse schedule files |
| `POST` | `/api/v1/normalize` | Normalize construction text |
| `POST` | `/api/v1/embed` | Generate embeddings |
| `POST` | `/api/v1/match` | Score observations against supplied activities |
| `POST` | `/api/v1/pipeline/process` | Synchronous text pipeline |
| `POST` | `/api/v1/pipeline/process-file` | Synchronous file pipeline |
| `POST` | `/api/v1/pipeline/submit-async` | Publish an async RabbitMQ job |
| `GET` | `/api/v1/jobs/{job_id}/status` | Read Redis-backed job state |

## Matching policy

The default `construction-v1` policy uses lexical (`0.40`), semantic (`0.45`), and context (`0.15`) weights, with additional safeguards for automatic matching.

- **Auto-link candidate:** score at least `0.85`, extraction confidence at least `0.70`, sufficient lexical evidence or an exact equipment match, a candidate gap of at least `0.08`, and no discipline mismatch.
- **Review candidate:** score from `0.40` to `<0.85`, or any candidate that does not meet all automatic-link safeguards.
- **Rejected candidate:** below `0.40` or no supplied activities.

The worker uses at-least-once processing. Consumers that persist a result must treat `job_id` or `idempotency_key` as unique to prevent duplicate writes.

## Tests and quality checks

```bash
# Frontend type check and production bundle
cd frontend && npm run build

# Frontend lint
cd frontend && npm run lint

# Rust trust-plane tests
cd backend && cargo test

# AI service tests
cd ai_service && .venv/bin/python -m pytest -q
```

A health helper is also available:

```bash
./scripts/health_probe.sh local
```

It is an informational probe for backend, AI, frontend, and optionally PostgreSQL. Review its output service by service; a successful script exit alone does not prove every HTTP service is reachable.

## Trust plane and engine features

- **Runtime persistence:** Rust API supports PostgreSQL persistence for domain state via connection pooling (`DATABASE_URL`), storing projects, observations, proposals, audit events, legal holds, archives, and outbox events, with automatic in-memory fallback for local development.
- **Trust validation & Invariants:** Deterministic Rust trust plane enforces date sequencing, monotonic progress advancements, positive quantity bounds, Start-to-Start (SS), Finish-to-Finish (FF), and Finish-to-Start (FS) predecessor constraints, and schedule DAG cycle detection.
- **Async intake contract:** RabbitMQ asynchronous job pipeline supports multi-modal files and text-only observation jobs with synthetic storage identifiers, processing tasks reliably without blocking HTTP threads.
- **Security hardening & JWT:** Full JWT Bearer token claims extraction (RFC 7515/7519) and expiration verification with role-based access control (RBAC), client IP/user sliding-window rate limiting, restrictive CORS (`ALLOWED_ORIGINS`), and defense-in-depth HTTP security headers.
- **P6 interoperability:** Schema-compliant Oracle Primavera P6 XML Schema V24 export (`APM:Project`, `APM:APMHeader`, `APM:Activity`) with activity-level progress, planned/actual dates, and acyclic schedule network validation.

## License

This project is licensed under the [MIT License](LICENSE).
