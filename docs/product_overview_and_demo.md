# NEXORA AI — Product Overview & SIH Demo Rehearsal Guide

## 1. Executive Summary & Product Vision

Major engineering, procurement, and construction (EPC) infrastructure projects (refineries, metro corridors, energy grids) suffer from severe delays and cost overruns caused by the **"Field-to-Schedule Information Disconnect"**:

- **The Problem**: Actual progress is captured in messy, unstructured daily PDFs, subcontractor spreadsheets, site photographs, and voice memos. Meanwhile, baseline schedules (Primavera P6, MS Project) are updated manually with weeks of lag, subjective guesswork, and human bias.
- **The Solution**: **NEXORA AI** is an AI-powered project intelligence and automated schedule reconciliation platform. It ingests heterogeneous field evidence, extracts structured work observations via normalized entities and 384-dimensional embeddings, validates claims through a zero-hallucination **Rust Trust Plane**, stages ambiguous proposals for human planner signoff, and commits immutable actual events with cryptographic SHA-256 audit trails.

---

## 2. The 5-Stage Zero-Hallucination Pipeline

```
[1. Ingestion Plane]      --> [2. AI Extraction]        --> [3. Hybrid Matcher]       --> [4. Rust Trust Plane]   --> [5. Immutable Ledger]
• PDF Reports             • NER & Normalization         • RapidFuzz Lexical (40%)     • Predecessor rules         • PostgreSQL commit
• Excel / CSVs            • Discipline classification   • 384-d Cosine Embed (40%)    • Date monotonic delta      • SHA-256 block hash
• Audio Transcripts       • Equipment tag extraction    • Context Boost (20%)         • State machine integrity   • P6 XML / CSV export
```

---

## 3. Command Centre Surfaces & User Flows

The NEXORA AI Command Centre operates across 6 integrated surfaces styled in the contemporary **Field Ledger** design movement:

1. **Command Centre Dashboard (`/`)**:
   - High-level KPIs: Ingested observations, auto-linked events, pending review count, schedule completion %.
   - Live operational state lanes and trust architecture visualization.
2. **Evidence Inbox & Ingestion Hub (`/evidence`)**:
   - File attachment dropzone with Supabase Storage integration (`evidence-documents` bucket).
   - Real-time 5-stage pipeline tracker.
   - Chronological evidence stream table with clickable **Evidence Detail Drawers**.
3. **Planner Review Queue (`/review`)**:
   - High-density 3-column human-in-the-loop review console.
   - Confidence score decomposition (Lexical, Semantic, Context Boost).
   - Interactive decision controls: Single Approve, Batch Approve, Activity Override, and Reject (with mandatory rationale).
4. **Project Explorer & Schedule (`/projects`)**:
   - Interactive WBS schedule table with multi-discipline and status filters.
   - Clickable table rows that slide out the **Activity 360° Drawer** detailing baseline vs. actual dates, variance, weightage, and trust rules.
5. **Cryptographic Audit Ledger (`/audit`)**:
   - Tamper-evident ledger of every state mutation with sequence IDs, timestamps, and actor roles.
   - Live "Verify Ledger Integrity" action checking SHA-256 hash chaining across all blocks.
   - Before/After JSON diff inspection.
6. **System Health & PMIS Export (`/export`)**:
   - Live backend health telemetry probe.
   - One-click export to **Oracle Primavera P6 (XML format)**, **CSV report**, and **JSON PMIS payload**.

---

## 4. Step-by-Step SIH Demo Rehearsal Script

To demonstrate the full power of NEXORA AI in a live competition or client presentation, execute the following 5 mandatory scenarios:

### Scenario A: High-Confidence Exact Match (Auto-Link)
- **Action**: Navigate to **Evidence Inbox** and click **"Scenario A: Exact Match"**.
- **Input Text**: *"P-101 completed successfully. Hydro test pack holding pressure maintained at 42.5 bar for 4 hours."*
- **What Happens**:
  - The AI extraction engine identifies tag `LINE-P-101` and discipline `PIPING`.
  - Matcher achieves **>90% confidence** against `PIP-2401`.
  - Because confidence exceeds the auto-link threshold (88%), the Rust Trust Plane immediately verifies predecessor constraints and commits progress to `PIP-2401` (100% completed) without requiring manual review.
  - An immutable SHA-256 audit entry is generated.

### Scenario B: Semantic Terminology Match (Embedding Search)
- **Action**: Click **"Scenario B: Semantic Match"**.
- **Input Text**: *"spool erection complete on Pipe Rack B Tier 2 with alignment and bolt tightening done."*
- **What Happens**:
  - Despite colloquial wording differences, the 384-dimensional sentence embedding matches `PIP-2400` (*"Spool Erection and Alignment - Pipe Rack B"*).
  - Demonstrates that field engineers do not need to memorize exact Primavera P6 activity codes.

### Scenario C: Ambiguous Multi-Header Match (Planner Review)
- **Action**: Click **"Scenario C: Ambiguous Match"**.
- **Input Text**: *"Hydrostatic pressure testing completed along Interconnecting Pipe Rack B headers yesterday."*
- **What Happens**:
  - The observation closely matches both `PIP-2401` (Crude Header) and `PIP-2402` (Naphtha Header).
  - Confidence is calculated at **76.0%** (Medium Tier).
  - The system routes the observation into the **Planner Review Queue** (`/review`).
  - Navigate to **Planner Review**, inspect the score breakdown, and click **"Approve & Commit"** or **"Override Match"**.

### Scenario D: Unmatched Scope (Emergency Pit Excavation)
- **Action**: Click **"Scenario D: Unmatched Work"**.
- **Input Text**: *"Emergency dewatering and deep foundation pit excavation carried out near Substation 4 due to heavy rain."*
- **What Happens**:
  - The work activity does not exist in the baseline L5 schedule.
  - Rather than hallucinating a false match, NEXORA AI isolates the observation in the **Unmatched Work Queue** for planner scope adjustment.

### Scenario E: Date Sequence Violation (Trust Plane Rejection)
- **Action**: Click **"Scenario E: Date Sequence Violation"**.
- **Input Text**: *"Line P-101 testing finished on 20-Aug-2026, work started on 28-Aug-2026."*
- **What Happens**:
  - The AI parses the reported dates.
  - The **Rust Trust Plane** catches the logical impossibility (`actual_finish_date < actual_start_date`).
  - The state machine immediately rejects the mutation, returning a `VALIDATION_ERROR` and preserving ledger integrity.

---

## 5. Primavera P6 Schedule Export Walkthrough

1. Navigate to **System Health & Export** (`/export`).
2. Click **"Export P6 XML"**.
3. A standardized Primavera P6 XML file (`NEXORA_PRD_PKG04_P6_Export_YYYY-MM-DD.xml`) is generated in the browser containing all actualized progress, verified start/finish dates, and percentage completions ready for direct import into Oracle Primavera P6.
4. Click **"Export CSV"** to generate an Excel/PowerBI schedule variance report.
