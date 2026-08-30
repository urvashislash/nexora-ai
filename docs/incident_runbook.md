# NEXORA AI — Incident Response & Recovery Runbook

This runbook provides actionable procedures for responding to common production anomalies, queue backlogs, trust validation spikes, and database errors.

---

## Incident Scenarios

### Scenario 1: RabbitMQ Ingestion Queue Backlog (> 50 messages)
**Symptom**: Field reports are submitted, but observations remain in `PROCESSING` state for over 5 minutes.

**Diagnosis**:
```bash
# Check queue depth and worker status
docker compose -f docker-compose.prod.yml logs --tail=100 ai_worker
```

**Resolution Steps**:
1. Scale up the AI worker container:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --scale ai_worker=3
   ```
2. If dead-letter messages exist:
   - Check error logs for unparseable PDF formats or OCR timeout limits.
   - Inspect dead-letter queue via RabbitMQ management interface (`http://127.0.0.1:15672`).

---

### Scenario 2: Rust Trust Plane High Rejection Rate (> 20%)
**Symptom**: Field progress observations are failing validation and getting rejected by the trust engine.

**Diagnosis**:
```bash
# Check backend validation logs
docker compose -f docker-compose.prod.yml logs --tail=100 backend | grep "VALIDATION_ERROR"
```

**Resolution Steps**:
1. Check if an outdated baseline schedule version was active when field reports were recorded.
2. If date sequences in field reports are inverted (finish before start), contact site scheduling engineers to re-issue corrected daily logs.
3. Review candidate matching explanations in the **Planner Review Queue** (`/review`).

---

### Scenario 3: Supabase Storage Quota or Permission Denial
**Symptom**: Document uploads fail with HTTP 403 / 413 error in Evidence Inbox.

**Diagnosis**:
```bash
# Check Supabase status
./scripts/health_probe.sh production
```

**Resolution Steps**:
1. Confirm the `evidence-documents` storage bucket exists and RLS policies allow authenticated project members to upload:
   ```sql
   SELECT * FROM storage.buckets WHERE id = 'evidence-documents';
   ```
2. Ensure `SUPABASE_SERVICE_ROLE_KEY` is current and not expired.

---

### Scenario 4: Bad Database Migration / Schema Regression
**Symptom**: Queries fail with missing column or relation errors after a deployment.

**Resolution Steps**:
1. Roll back the database to the last verified backup:
   ```bash
   ./scripts/restore_db.sh backups/latest_safe_backup.dump
   ```
2. Repair the Supabase migration history:
   ```bash
   npx supabase migration repair --status reverted <MIGRATION_VERSION>
   ```
