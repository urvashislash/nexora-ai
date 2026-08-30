# NEXORA AI — Audit Retention & Archival Policy

## 1. Statutory & Compliance Requirements

In major capital projects (Oil & Gas, Infrastructure, EPC), project records, field observation evidence, schedule updates, and approval logs are subject to statutory retention periods under:
- FIDIC & NEC Contractual Dispute Windows (typically 6–12 years)
- Statutory limitation periods for construction defect claims (typically 7–10 years)
- International financial compliance (SOX / IFRS / SOC 2 Type II)

---

## 2. Retention Schedule

| Storage Tier | Data Scope | Retention Period | Storage Target | Access SLA |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Hot Operational Ledger** | Active project audit events, state machine transitions, proposal approvals | **90 Days** | PostgreSQL `audit_trail` table | Immediate (< 50ms) |
| **Tier 2: Cold Cryptographic Archive** | Older verified audit chains packaged into immutable batches with Merkle/Root hashes | **7 Years** | WORM (Write Once Read Many) Cloud Storage (AWS S3 Glacier / Supabase Archive) | < 1 Hour |
| **Tier 3: Permanent Dispute Hold** | Audit chains tagged under active dispute or legal hold | **Indefinite** | WORM Object Lock / Encrypted Vault | Immediate |

---

## 3. Cryptographic Chain Integrity Verification

Before any audit events can be moved from Tier 1 (Hot) to Tier 2 (Cold), the system performs an end-to-end cryptographic verification using SHA-256 hash chaining:

$$H_i = \text{SHA-256}(\text{Entity ID} \parallel \text{Action} \parallel \text{Payload} \parallel \text{Timestamp} \parallel H_{i-1})$$

If any single record has been tampered with or modified:
1. Archival execution is **aborted immediately**.
2. An alert is logged to the SecOps incident channel.
3. The broken index is reported to the system auditor for forensic investigation.

---

## 4. Legal Hold Procedures

### Enabling Legal Hold
When litigation, arbitration, or an official audit inquiry is initiated:
```bash
POST /api/v1/projects/{project_id}/audit-trail/legal-hold
{
  "enabled": true,
  "reason": "Arbitration Case ARB-2026-0814",
  "authorized_by": "a0000000-0000-0000-0000-000000000001"
}
```

### Protection Enforcement
- All automated retention pruning jobs skip records for projects with active legal hold.
- Direct deletion attempts by any role (including Admin) fail database constraint and RLS checks.

---

## 5. End-of-Lifecycle Secure Deletion

Upon expiration of the 7-year statutory window (and confirming absence of legal holds):
1. Archive manifest is logged with cryptographic signature of deletion authorization.
2. Cold archive batches are purged according to DoD 5220.22-M / NIST SP 800-88 cryptographic erasure standards.
