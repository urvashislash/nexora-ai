# NEXORA AI — Production Monitoring & Alerting Guide

This document defines the production observability standards, Service Level Objectives (SLOs), metric indicators (SLIs), and alert routing rules for the NEXORA AI Command Centre platform.

---

## 1. Service Level Objectives (SLOs)

| Metric | Target | Measurement Window |
|---|---|---|
| **API Availability** | &ge; 99.95% | 30-day rolling window |
| **API Response Latency (p95)** | &le; 250ms | 5-minute window |
| **Field Document Processing Latency** | &le; 15 seconds | Per standard daily report |
| **Trust Layer Zero-Hallucination Rate** | 100% | Continuous (0 invalid state transitions) |
| **Event Ledger Append Integrity** | 100% | SHA-256 chain verification check |

---

## 2. Key Telemetry Indicators (SLIs)

### 2.1 Rust Backend API
- `http_requests_total{status=~"5.."}`: Rate of server-side errors.
- `http_request_duration_seconds{quantile="0.99"}`: 99th percentile request duration.
- `trust_plane_rejections_total{reason="..."}`: Frequency of rejected progress events due to predecessor or monotonicity violations.
- `audit_chain_blocks_total`: Cumulative count of cryptographically signed ledger blocks.

### 2.2 Python AI Service & Queue Worker
- `observation_extraction_duration_seconds`: Time spent parsing and normalizing text/PDFs.
- `embedding_cosine_similarity_histogram`: Distribution of semantic match confidence scores.
- `rabbitmq_queue_messages_ready{queue="document_ingestion"}`: Queue backlog depth.
- `rabbitmq_queue_messages_dead_lettered`: Count of poisoned/failed ingestion payloads.

### 2.3 Supabase & PostgreSQL
- `pg_stat_activity`: Active client connections and connection pool exhaustion.
- `pg_replication_lag`: Primary-to-replica lag (if multi-region active).
- `storage_bytes_used`: Supabase evidence document bucket volume.

---

## 3. Alert Severity & Response Matrix

| Severity | Condition | Notification Channel | Response Time | Action |
|---|---|---|---|---|
| **P0 — Critical** | API Availability < 99%, DB connection pool exhausted, or SHA-256 audit verification failure. | PagerDuty + SMS + Ops Call | **&le; 5 minutes** | Immediate rollback or failover; halt automated ledger commits. |
| **P1 — Major** | Queue backlog > 50 messages, AI worker crash loop, or Storage upload failure rate > 5%. | PagerDuty + Slack `#alerts-ops` | **&le; 15 minutes** | Scale worker pods; restart stalled consumers; verify Supabase credentials. |
| **P2 — Warning** | Unmatched observation rate > 30%, single API endpoint p95 > 500ms, or Redis memory > 80%. | Slack `#alerts-ops` | **&le; 1 hour** | Inspect field terminology drift; clean expired cache keys. |

---

## 4. Centralized Structured Logging Standards

All services emit machine-readable JSON logs with standard tracing headers:

```json
{
  "timestamp": "2026-08-31T01:30:00.123Z",
  "level": "INFO",
  "service": "nexora-backend",
  "correlation_id": "corr-7f8a9b0c-1234",
  "project_id": "a0000000-0000-0000-0000-000000000001",
  "actor_id": "00000000-0000-0000-0000-000000000001",
  "actor_role": "PLANNER",
  "action": "APPROVE_PROPOSAL",
  "message": "Proposal prop-01 approved and committed to activity PIP-2401"
}
```

---

## 5. Health Probe Verification

Execute automated health probes locally or in staging:

```bash
./scripts/health_probe.sh production
```
