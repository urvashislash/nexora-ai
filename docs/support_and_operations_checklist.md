# NEXORA AI — Production Support & Operations Checklist

This document details the operational checklists, escalation contacts, and routine maintenance schedules for supporting the NEXORA AI Command Centre platform.

---

## 1. Routine Maintenance Schedule

### Daily Checklist
- [ ] Execute `./scripts/health_probe.sh production` to confirm availability of all services.
- [ ] Check RabbitMQ queue depth for unconsumed or dead-lettered field documents.
- [ ] Review pending items in the **Planner Review Queue** (`/review`) with lead planning engineers.
- [ ] Verify that automated daily database backups were generated in `backups/` or cloud storage.

### Weekly Checklist
- [ ] Run cryptographic SHA-256 audit chain verification check on the production event ledger.
- [ ] Inspect matching precision/recall distribution in AI service logs to detect field terminology drift.
- [ ] Review failed authentication attempts and RBAC access logs in Supabase.
- [ ] Check Supabase evidence storage bucket volume and clean orphaned temporary files.

### Monthly Checklist
- [ ] Rotate API secrets, service tokens, and database credentials per [`docs/secrets_management.md`](file:///Users/sirwagyashekhar/Projects/nexora-ai/docs/secrets_management.md).
- [ ] Perform a test database restore using [`scripts/restore_db.sh`](file:///Users/sirwagyashekhar/Projects/nexora-ai/scripts/restore_db.sh) on a staging instance.
- [ ] Archive historical audit events older than standard project retention windows per [`docs/audit_retention_policy.md`](file:///Users/sirwagyashekhar/Projects/nexora-ai/docs/audit_retention_policy.md).

---

## 2. Support Escalation Matrix

| Tier | Role | Responsibilities | SLA |
|---|---|---|---|
| **Tier 1** | Field Site Coordinator / Subcontractor Support | Resolves document scanning issues, OCR read errors, and manual field entry mistakes. | 30 minutes |
| **Tier 2** | Lead Project Planner | Resolves ambiguous match proposals, conflicting field reports, and scope overrides in the Review Queue. | 2 hours |
| **Tier 3** | DevOps / Platform Engineer | Investigates API downtime, RabbitMQ broker lag, container crashes, and Supabase cloud connectivity. | 15 minutes (P0) / 1 hour (P1) |
| **Tier 4** | Core Engineering / AI Lead | Debugs trust engine state machine invariant failures, embedding model issues, and schema migrations. | 4 hours |

---

## 3. Incident Severity Definitions

- **P0 (Critical)**: Production web console down, database inaccessible, or SHA-256 audit chain integrity compromised.
- **P1 (Major)**: Queue processing stopped, AI extraction service throwing 500s, or evidence upload bucket full.
- **P2 (Minor)**: UI styling glitches, non-critical latency spikes, or localized terminology matching errors.
- **P3 (Informational)**: Feature requests, routine documentation updates, or minor logging enhancements.

---

## 4. Post-Incident Review Protocol (PIR)

Within 24 hours of any P0/P1 incident resolution:
1. Document the root cause in an incident report.
2. Verify that automated regression tests have been added to prevent recurrence.
3. Review and update [`docs/incident_runbook.md`](file:///Users/sirwagyashekhar/Projects/nexora-ai/docs/incident_runbook.md).
