# Database Backup and Disaster Recovery Strategy

## 1. Overview
This document outlines the backup, retention, and disaster recovery strategy for NEXORA AI databases across both local containerized environments and hosted Supabase cloud instances.

## 2. Environments

### 2.1 Local Docker / Staging
- **Tooling:** PostgreSQL native `pg_dump` and `pg_restore` wrappers in `scripts/backup_local_db.sh` and `scripts/restore_local_db.sh`.
- **Format:** Custom directory/archive format (`-F c`) with blob and schema consistency.
- **Location:** Local gitignored `backups/` directory or mounted persistent volumes.

### 2.2 Hosted Supabase Cloud
- **Automated Backups:** Daily automated snapshot backups managed by Supabase (Pro/Team tiers support Point-In-Time-Recovery (PITR)).
- **Pre-migration Snapshots:** Run automated dumps before applying critical structural migrations or major seed reloads.

## 3. Recovery Verification Checklist
1. Verify target database connection and extension readiness (`pgvector`, `uuid-ossp`, `pg_trgm`).
2. Run `scripts/restore_local_db.sh <backup_file>` or trigger Supabase PITR restoration.
3. Validate table row counts (`projects`, `activities`, `actual_events`, `audit_events`).
4. Validate tamper-evident audit hash integrity on `audit_events`.
5. Execute application health check endpoint to ensure API connectivity.

## 4. Retention Policy
- **Development/Staging Snapshots:** 14-day rolling retention.
- **Production Nightly Dumps:** 90-day retention with encrypted off-site replication.
