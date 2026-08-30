# NEXORA AI — Production Deployment Runbook

This runbook outlines the zero-downtime deployment procedure for the NEXORA AI Command Centre across the frontend, Rust backend, Python AI service, and Supabase cloud database.

---

## 1. Pre-Deployment Checklist

Before triggering a production deployment:

- [ ] All CI checks in [`.github/workflows/ci.yml`](file:///Users/sirwagyashekhar/Projects/nexora-ai/.github/workflows/ci.yml) must be green on `production`.
- [ ] Database migrations in `supabase/migrations/` have been reviewed and tested.
- [ ] Production environment secrets are configured in the target container runtime or vault.
- [ ] An on-demand database backup has been taken via `scripts/backup_db.sh`.

---

## 2. Step-by-Step Deployment Procedure

### Step 1: Database Migration Deployment (Supabase Cloud)
Always deploy database schema updates before rolling out newer application code.

```bash
# 1. Ensure linked to production project
./scripts/link_supabase.sh vitxgshrjpyvczidzvto production

# 2. Push migrations to Supabase Cloud
./scripts/deploy_to_supabase.sh
```

### Step 2: Application Container Deployment

Using Docker Compose / Kubernetes:

```bash
# 1. Pull latest verified production images
docker compose -f docker-compose.prod.yml pull

# 2. Re-create and restart containers with zero downtime
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# 3. Verify running container health status
docker compose -f docker-compose.prod.yml ps
```

### Step 3: Post-Deployment Health & Verification

Execute the health probe to verify that all endpoints and databases respond:

```bash
./scripts/health_probe.sh production
```

Verify the following:
1. Rust API returns `200 OK` on `/api/v1/health`.
2. AI Service returns `200 OK` on `/health`.
3. Frontend returns `200 OK` on `/healthz`.
4. Run an audit verification check via `./scripts/health_probe.sh`.

---

## 3. Fast Rollback Procedure

If critical regressions or P0 errors occur:

```bash
# 1. Execute automated rollback
./scripts/rollback.sh
```

Refer to [`docs/incident_runbook.md`](file:///Users/sirwagyashekhar/Projects/nexora-ai/docs/incident_runbook.md) for detailed disaster recovery protocols.
