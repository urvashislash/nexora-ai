# NEXORA AI — Role-Based Access Control (RBAC) & Tenant Isolation

## 1. Overview & Architecture

NEXORA AI implements a multi-tiered authorization model:
1. **Rust Trust Plane (Primary Authorizer)**: Sole enforcer of business rules, event commitments, and state transitions. Every incoming request must provide authenticated context (`X-User-Id`, `X-User-Role` or verified JWT).
2. **PostgreSQL Row-Level Security (Defense-in-Depth)**: Ensures direct Supabase queries from authenticated browser sessions cannot cross project boundaries.
3. **Multi-Tenant Project Isolation**: All core entities (`activities`, `observations`, `proposals`, `events`, `audit_trail`) are partitioned by `project_id`.

```mermaid
graph TD
    User([User / Browser]) -->|JWT / Headers| Gateway[API Gateway / Trust Plane]
    Gateway -->|Permission Check| RBAC{Role Matrix}
    RBAC -->|Allowed| Handler[Rust Endpoint Handler]
    RBAC -->|Forbidden| Err403[403 Forbidden Response]
    Handler -->|Service Role| DB[(Supabase PostgreSQL)]
    User -.->|Direct Read Fallback| SupabaseAnon[Supabase PostgREST]
    SupabaseAnon -->|RLS auth.uid()| DB
```

---

## 2. Role Permission Matrix

| Role | Description | Project Scope | Allowed Actions |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | Project owner / System administrator | All assigned projects | Full access: configure projects, assign members, review/approve/override proposals, export schedules, manage legal hold & retention policies. |
| **`PLANNER`** | Lead planner / Schedule engineer | Assigned projects | Review queue, approve proposals, reject with reason, override activity assignments, export P6/MS Project schedules. |
| **`ENGINEER`** | Field / discipline engineer | Assigned projects | View project progress & activities, submit observations and site progress reports. |
| **`SUPERVISOR`**| Construction field supervisor | Assigned projects | View activities, submit daily field progress observations and voice/photo evidence. |
| **`AUDITOR`** | Independent compliance / quality auditor | Assigned projects | Read-only access to dashboard, activities, observations, and full cryptographic audit ledger. |
| **`VIEWER`** | Executive stakeholder / Client observer | Assigned projects | Read-only access to high-level progress dashboards and KPIs. |

---

## 3. Detailed Permission Mapping

| Endpoint / Operation | Minimum Permission | Admin | Planner | Engineer | Supervisor | Auditor | Viewer |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `GET /projects/:id/dashboard` | `ViewProject` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /projects/:id/activities` | `ViewProject` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /projects/:id/review-queue`| `ViewProject` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /projects/:id/observations`| `CreateObservation`| ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `POST /projects/:id/ingest` | `CreateObservation`| ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `POST /proposals/:id/approve` | `ApproveProposal` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST /proposals/:id/reject` | `ApproveProposal` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST /proposals/:id/override` | `OverrideProposal` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /projects/:id/audit-trail` | `ViewAudit` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `GET /projects/:id/audit-trail/verify`| `ViewAudit` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `POST /projects/:id/audit-trail/archive`| `ManageRetention`| ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `POST /projects/:id/audit-trail/legal-hold`| `ManageRetention`| ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `GET /projects/:id/export/p6` | `ExportSchedule` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 4. Cross-Project Isolation & Data Leakage Prevention

1. **URL & Path Param Validation**: Every route with `:id` verifies that the caller has an active `project_members` mapping with `is_active = true`.
2. **Document & Evidence Isolation**: Storage buckets are partitioned by `/{project_id}/{document_id}/{filename}`. Direct download URLs are signed with short (15-minute) expirations.
3. **Audit Log Privacy**: Audit events contain project-scoped hashes and never leak credentials or cross-tenant metadata.
