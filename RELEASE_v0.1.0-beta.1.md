# NEXORA Beta Release — v0.1.0-beta.1

**Release Tag:** `v0.1.0-beta.1`  
**Target Environment:** `beta`  
**Release Date:** September 2026  
**Status:** Ready for Customer Evaluation  

---

## 1. Executive Summary

NEXORA `v0.1.0-beta.1` establishes the end-to-end product journey:
```
Signup → Create Team → Invite Team Members → Create Project →
Import Schedule → Upload Field DPR / Evidence → AI Match Proposal →
Human Planner Review & Approve → Dynamic S-Curve / Gantt Update → Hash-Chained Audit Trail
```

All demo data, synthetic test fixtures, and mock fallbacks have been eliminated from production execution. Frontend state is 100% backend-authoritative against PostgreSQL and Supabase.

---

## 2. Core Capabilities Delivered

### Multi-Tenant Team & Organization Architecture
- **Hierarchical Governance:** `User → Team → Project → Activities / Evidence / Events`.
- **Database Multitenancy:** `teams`, `team_members`, and `team_invitations` with cryptographic cascade isolation via PostgreSQL Row Level Security (RLS) policies keyed on `team_id` and `auth.uid()`.
- **Transactional Team Provisioning:** Atomic team creation + owner membership + audit event logging.
- **Team Settings & Governance:** Member invitations, role modifications (`OWNER`, `ADMIN`, `PLANNER`, `ENGINEER`, `SUPERVISOR`, `AUDITOR`, `VIEWER`), ownership transfer, and typed confirmation name verification prior to destructive deletion.

### Authentication & RBAC (Supabase Auth)
- Full Supabase Auth lifecycle: Email signup, magic link/password login, email verification, password reset, session renewal, and account offboarding.
- Cryptographic JWT validation on all sensitive backend routes rejecting client-controlled spoofing headers.
- **Uninformative Denials:** Cross-tenant or unauthorized resource access returns generic `404 Not Found` to prevent entity ID existence leakage.

### Schedule Import & Synchronization
- **Multi-Format Ingestion:** Native support for CSV (P0), Excel XLSX (P1), and Primavera P6 XER exports (P2).
- **Validation Engine:** Pre-import validation inspecting activity code uniqueness, date consistency, duration plausibility, and critical path continuity before commit.
- **Dynamic Gantt Timeline:** Real schedule boundary computation (`min(planned_start)` to `max(planned_finish)`), eliminating hardcoded calendar timelines.

### Multi-Modal Evidence & AI Match Reasoning
- **Accepted Formats:** PDF DPRs, PNG/JPG site photos, Excel quantity logs, and WebM/Opus audio memos.
- **Strict Ingestion Validation:** Enforces 50MB file size limits, MIME type verification, and path-traversal filename sanitization.
- **Explainable Match Rationale:** Discloses equipment tag matches, spatial location proximity, discipline alignment, and semantic vector similarity.
- **Safety Invariant:** AI never directly alters schedule truth (`AI → Proposal → Planner Review → Commit`).

### Operational Controls & Kill Switches
- `AI_AUTO_LINK_ENABLED` & `FEATURE_AUTO_LINK`: Kill switch for automatic commit of high-confidence proposals.
- `DOCUMENT_INGESTION_ENABLED`: Instant pause of multi-modal evidence ingestion.
- `FEATURE_TEAM_INVITES`: Kill switch for external email invitation dispatch.

---

## 3. Supported File Formats & Bounds

| Ingestion Type | Accepted Extensions | Maximum Size | Processing Engine |
| :--- | :--- | :--- | :--- |
| **Schedule Baseline** | `.csv`, `.xlsx`, `.xer` | 25 MB | Rust Schedule Ingestion Engine |
| **Daily Progress Reports (DPR)** | `.pdf` | 50 MB | PyMuPDF / Extraction Worker |
| **Site Photos / Evidence** | `.png`, `.jpg`, `.jpeg` | 50 MB | Multi-Modal Visual Inspection |
| **Field Voice Memos** | `.webm`, `.mp3`, `.wav`, `.m4a` | 50 MB | Web Audio API / Whisper ASR |

---

## 4. Known AI Limitations & Disclaimers

> **In-Product Beta Notice:**  
> *"NEXORA is currently in beta. AI-generated matches are suggestions and require human verification before being committed to project records."*

1. **OCR Quality on Degraded Scans:** Heavily compressed or photographed physical reports with skewed text may exhibit lower extraction recall.
2. **Ambiguous Equipment Tags:** Hand-written notes lacking standardized plant numbering codes will be routed to the Planner Review Queue with `NEEDS_REVIEW` status.
3. **Precedence Invalidation Guard:** The Trust Plane will reject any human approval that violates schedule dependency precedence (e.g. attempting to finish foundation grouting before bolt alignment signoff).

---

## 5. Rollback Plan & Database Procedures

### Rollback Strategy
If a critical regression is detected in `v0.1.0-beta.1`:
1. **Frontend Rollback:** Redeploy previous release asset bundle from CDN or Docker registry tag.
2. **Backend Rollback:** Revert backend container image tag in deployment manifest.
3. **Database Migration Rollback:**
   ```sql
   -- Down migration for 010_teams_multitenancy.sql
   DROP POLICY IF EXISTS "tenant_isolation_teams" ON teams;
   DROP POLICY IF EXISTS "tenant_isolation_projects" ON projects;
   DROP POLICY IF EXISTS "tenant_isolation_documents" ON documents;
   DROP TABLE IF EXISTS team_invitations CASCADE;
   DROP TABLE IF EXISTS team_members CASCADE;
   ALTER TABLE projects DROP COLUMN IF EXISTS team_id;
   DROP TABLE IF EXISTS teams CASCADE;
   ```

### Backup & Disaster Recovery Verification
- **Automated PostgreSQL Snapshots:** Scheduled every 6 hours via Supabase / managed Cloud SQL.
- **Verification Drill:** Restoration test verified against isolated staging database confirming point-in-time recovery (PITR) within 15 minutes.
