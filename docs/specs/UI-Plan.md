# NEXORA AI — UI/UX Implementation Plan

This document outlines the detailed plan for all UI/UX pages to be built for the NEXORA AI Command Centre, based on the **Field Ledger** design system.

## 1. Global Shell & Navigation
- **Persistent Left Sidebar:** Primary navigation preserving orientation across all views.
  - Links: Command Centre (Home), Projects, Evidence Inbox, Review Queue, Conflicts, Audit & Traceability, System Health.
  - Brand Mark: N-shaped survey bracket in graphite and NEXORA Ochre.
- **Top Header:** Displays verified operational conditions, global sync state, and context (project ID/name).
- **Drawers instead of Modals:** Contextual details (Planner Review, Activity 360°, Evidence Detail) slide in as firm operational sheets from the right, preventing loss of context.

## 2. Page Specifications

### 2.1 Command Centre Dashboard (`/`)
- **Purpose:** Entry surface providing a high-level operational overview of the project's ground truth.
- **Components:**
  - Project header with key metrics (total activities, processed evidence, pending reviews).
  - Activity state lanes summarizing workflow progression.
  - Mini review queue and evidence stream snippets.
  - Trust layer health status.

### 2.2 Project Explorer (`/projects`)
- **Purpose:** Deep dive into the project schedule and activity states.
- **Components:**
  - Collapsible WBS (Work Breakdown Structure) tree.
  - Compact engineering activity table (columns: ID, Name, State, Discipline, Dates, Progress).
  - Filters: Discipline, location, state, date, schedule-version.
- **Interactions:** Clicking a row opens the **Activity 360° Drawer** detailing event history, provenance, and current state.

### 2.3 Evidence Inbox (`/evidence`)
- **Purpose:** Real-time stream of incoming field data and operational documents.
- **Components:**
  - Summary counts: Received, Processing, Matched, Review, Conflict.
  - Drag-and-drop "Add Evidence" affordance with realistic file intake states.
  - Chronological evidence stream (columns: source type, timestamps, titles, processing states, observations, match confidence).
  - Support for pipeline states: `RECEIVED`, `PROCESSING`, `EXTRACTED`, `MATCHED`, `REVIEW REQUIRED`, `FAILED`, etc.
- **Interactions:** Clicking a row opens the **Evidence Processing Detail Route/Drawer**.

### 2.4 Evidence Processing Detail (`/evidence/processing`)
- **Purpose:** Transparent view into AI extraction and matching logic.
- **Components:**
  - **Three Stages:** SOURCE → AI INTERPRETATION → MATCH PROPOSAL.
  - Original transcript/document excerpt with highlighted evidence text.
  - Extracted fields (discipline, equipment, location, action, event, time) styled in muted blue to denote AI origin.
  - Candidate activities with explainable confidence score breakdown.
  - Technical metadata (document, job, model, prompt, embedding versions).
  - Trust outcome actions distinguishing AI claims from verified states.

### 2.5 Planner Review (`/review`)
- **Purpose:** Interface for human validation of AI-proposed matches before committing to the ledger.
- **Components:**
  - **Three-column layout:**
    1. Original source evidence with highlighted text.
    2. Proposed activity, confidence, extracted facts, project context, alternatives, and score breakdown.
    3. Decision controls and validation checklist.
  - Decision Controls: `APPROVE`, `CORRECT` (select alternate activity), `REJECT` (requires reason), plus comments.
  - **Trust Validation Checklist:** Explicit UI confirming authentication, activity existence, temporal validation, and approval policy.

### 2.6 Conflict Resolution (`/conflicts/:conflictId`)
- **Purpose:** Handling conflicting claims (e.g., progress regressions or overlapping reports).
- **Components:**
  - Side-by-side source comparison with highlighted conflicting fields.
  - Evidence-preservation language showing the flow: Resolution → Trust Validation → Event Ledger → Current State.
  - Resolution actions requiring a mandatory resolution reason.

### 2.7 Audit & Traceability (`/audit`)
- **Purpose:** Non-repudiable history of every state change and decision.
- **Components:**
  - Identifier search (by event ID, correlation ID).
  - Clickable provenance chain with expandable nodes.
  - AI metadata, request/event IDs, and explicit "Nothing happened invisibly" audit messaging.

### 2.8 Integrations & System Health (`/health`)
- **Purpose:** Operations control surface for end-to-end system flow.
- **Components:**
  - System topology health, queue latency, recent jobs, failures, successful syncs, failed deliveries.
  - Safe-event messaging for downstream services.
  - Export controls (CSV, JSON, PMIS-compatible formats).

## 3. Development Workflow & Validation
- **Styling:** Adhere strictly to the `DESIGN.md` guidelines using existing CSS tokens in `client/src/index.css`.
- **Validation:** 
  - Ensure mobile and desktop layouts remain responsive using strict 8px grids.
  - Verify routing does not break the persistent sidebar state.
  - Ensure all features operate on realistic data shapes without hallucinating unavailable data.
