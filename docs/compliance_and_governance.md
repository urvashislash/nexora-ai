# NEXORA AI — Compliance, Governance & Data Handling

## 1. Compliance Framework Alignment

NEXORA AI is designed to support enterprise-grade security and compliance standards for capital project owners, EPC contractors, and engineering consultants.

### Standard Controls Mapping
- **SOC 2 Type II (Trust Services Criteria)**:
  - *CC6.1 - Access Control*: Enforced by Rust RBAC middleware + PostgreSQL Row-Level Security.
  - *CC6.6 - Boundary Protection*: Strict rate limiting, CORS controls, and defense-in-depth security response headers.
  - *CC7.2 - Change Management*: Complete SHA-256 audit chaining on all schedule lifecycle mutations.
- **GDPR & Privacy**:
  - Personal Data minimization: Only work email, user ID, and role are retained in user profiles.
  - Right to be Forgotten: Field observations and site photos scrub PII while preserving schedule mathematical integrity.
  - Data Residency: Multi-region hosting configurations ensure data stays within contractual or jurisdictional bounds (e.g. EU-West, US-East, India Central).

---

## 2. Data Classification Matrix

| Data Tier | Examples | Encryption at Rest | Encryption in Transit | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Confidential - Schedule & Financial** | WBS, P6 Baselines, Progress %, Delay claims | AES-256 | TLS 1.3 / HTTPS | Authenticated project members |
| **Confidential - Field Evidence** | Site photos, inspection notes, voice memos | AES-256 (SSE-S3) | TLS 1.3 / HTTPS | Engineers, Planners, Auditors |
| **Restricted - System & Auth** | JWT Signing Keys, DB Credentials, Audit Chains | AES-256-GCM / KMS | TLS 1.3 | Backend Trust Plane only |
| **Internal - Metadata** | Health checks, API docs, system version | Standard | TLS 1.3 | Authenticated users |

---

## 3. Client Sharing & External Deployment Rules

1. **Air-Gapped / On-Premise Deployments**:
   - The Python AI service supports offline embedding execution via cached local sentence-transformers models (`EMBEDDING_BACKEND=local`, `EMBEDDING_ALLOW_DOWNLOAD=false`).
   - The Rust Trust Plane requires zero external internet calls when PostgreSQL and Redis are hosted locally.
2. **Third-Party Contractor Access**:
   - Contractors and subcontractors must be onboarded as `SUPERVISOR` or `ENGINEER` with project-level boundaries.
   - Subcontractors cannot access schedule baseline models, financial weightings, or claims audit logs.
3. **Data Export & Portability**:
   - Authorized planners can export schedule XMLs compatible with Oracle Primavera P6 (V24 schema) and MS Project.
   - All exports generate an immutable `EXPORT_SCHEDULE_P6` audit entry with the exporter's identity and timestamp.
