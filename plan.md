# NEXORA AI — Remaining Project Plan

This document lists every major task still required to take the project from its current working prototype state to a production-ready, demonstrable, and deployable product.

## 1. Core Product Completion

### 1.1 Finalize product flow end-to-end
- Complete the full document ingestion workflow: upload → parse → extract → normalize → match → review → commit.
- Confirm that each stage works with real project data and not just mock/demo values.
- Ensure all workflow states match the locked lifecycle: PROPOSED → MATCHED → REVIEW_REQUIRED → APPROVED → COMMITTED.

### 1.2 Real activity matching pipeline
- Connect daily report parsing, spreadsheet ingestion, and other source files into the actual matching engine.
- Implement robust normalization for discipline-specific naming variations and abbreviations.
- Tune candidate ranking logic using real schedule and observation datasets.
- Add a consistent confidence model and deterministic tie-breaking rules.

### 1.3 Planner review and approval UX
- Build a review queue for uncertain or low-confidence matches.
- Allow users to accept, reject, override, or comment on proposed matches.
- Make sure approval actions produce auditable changes and update the activity state.

### 1.4 Auditability and trust-layer enforcement
- Ensure every AI-generated or human-approved action is logged into the audit trail.
- Add tamper-aware record hash or chain logic for critical audit entries.
- Require state-machine validation before any event can be committed.

## 2. Data and Database Completion

### 2.1 Complete schema validation
- Audit every table against the locked MVP design and ensure all required references are present.
- Confirm primary and foreign-key correctness across all lifecycle entities.
- Add missing indexes, constraints, and validation logic for production durability.

### 2.2 Add project data seed and realistic fixtures
- Seed at least one full realistic project with WBS, activities, dependencies, and schedule versions.
- Seed historical and current progress data for demos and UI testing.
- Add reusable seed scripts for repeatable local/cloud onboarding.

### 2.3 Data quality and integrity checks
- Add checks for duplicate activities, invalid date ranges, impossible progress values, and missing dependencies.
- Validate schedule ordering and WBS hierarchy consistency.
- Add safe fallback behavior when data is missing, malformed, or partially uploaded.

### 2.4 RLS and auth policy completion
- Define row-level security rules for project members, planners, auditors, and admins.
- Restrict access so users can only see their project data.
- Validate both anon and authenticated access patterns.

### 2.5 Database backup and restore setup
- Create backup strategy for Supabase cloud and local dev environments.
- Document recovery steps and restore verification process.
- Define retention and disaster-recovery expectations.

## 3. Supabase Integration Completion

### 3.1 Cloud project hardening
- Confirm the actual Supabase project is connected to the repo, not just a dev placeholder.
- Add a production-safe env management process for secrets and keys.
- Separate dev, staging, and production values clearly.

### 3.2 Storage and file handling
- Finish file upload logic for evidence documents and attachments.
- Ensure document metadata is stored in the database and files are stored in Supabase Storage.
- Add lifecycle states for uploaded, queued, processed, completed, and failed files.
- Validate file naming, bucket permissions, and signed access rules.

### 3.3 Auth and user role mapping
- Connect Supabase Auth with project member roles.
- Map user identities to project roles like ADMIN, PLANNER, ENGINEER, SUPERVISOR, AUDITOR, VIEWER.
- Make auth/session persistence reliable in the frontend.

### 3.4 Cloud migration validation
- Verify schema migrations work on the hosted cloud database without manual drift.
- Test database reset and re-seeding procedures against Supabase.
- Validate that pgvector operations behave as expected with the actual Supabase Postgres instance.

## 4. AI and Processing Layer Completion

### 4.1 Document parsing
- [x] Implement end-to-end PDF extraction and parsing.
- [x] Support spreadsheets and tabular discipline datasets.
- [x] Add image and OCR handling for site photo evidence.
- [x] Add ASR or voice transcription support where needed.

### 4.2 Extraction and normalization
- [x] Complete the text extraction pipeline for daily reports, progress logs, and schedule imports.
- [x] Normalize discipline names, equipment tags, quantities, dates, and units consistently.
- [x] Improve contextual understanding for real construction site language.

### 4.3 Embeddings and matching
- [x] Generate embeddings for activities and observation text using the selected sentence-transformer model.
- [x] Test and tune vector retrieval quality against a realistic dataset.
- [x] Add fallback logic for low-confidence or no-match cases.

### 4.4 Matching confidence and review thresholds
- [x] Validate match confidence thresholds using a realistic, labelled multi-discipline field dataset.
- [x] Tune high-confidence, review-needed, and rejection boundaries.
- [x] Ensure uncertain matches are escalated to human review instead of auto-committing.

### 4.5 Queue worker reliability
- [x] Complete RabbitMQ integration and job flow orchestration.
- [x] Add retries, dead-letter queues, and idempotent processing.
- [x] Handle partial processing failures without losing evidence or state.

Implementation and verification details are documented in `ai_service/README.md`.

## 5. Rust Backend Completion

### 5.1 Trust plane logic
- Complete the actual state machine validation logic for all event transitions.
- Enforce approval restrictions and project-level access rules.
- Prevent invalid lifecycle changes or duplicate event generation.

### 5.2 API layer completion
- Finish all REST endpoints needed for upload, review, approval, audit, and export operations.
- Add consistent validation and structured error responses.
- Standardize JSON contracts across frontend, backend, and AI service.

### 5.3 Event outbox and transactional correctness
- Add robust outbox/event publication for downstream processing.
- Ensure database transactions and async job triggers are consistent.
- Make event replay and idempotency safe.

### 5.4 Security and RBAC
- Enforce project-level and role-based authorization on every sensitive endpoint.
- Add API authentication and token validation for service-to-service calls.
- Validate headers, payload signatures, and secret handling across services.

## 6. Frontend Completion

### 6.1 Replace static/mock data with live data
- Connect dashboards, review queue, and schedule explorer to real API responses.
- Replace hardcoded demo values with dynamic project data from the backend and Supabase.
- Add loading, empty, and error states across all screens.

### 6.2 Complete user workflows
- Upload evidence files from browser to Supabase Storage.
- Show project dashboard KPIs derived from real database content.
- Display review queue, evidence history, and match confidence details.
- Add planner approval and audit detail screens.
- Build export and report-generation screens for project stakeholders.

### 6.3 UX quality and polish
- Improve form validation, empty states, toasts, loading feedback, and error guidance.
- Make mobile and desktop layouts responsive and consistent.
- Add visual clarity for critical actions: approve, reject, override, commit.

### 6.4 Performance and caching
- Optimize repeated calls to Supabase and API endpoints.
- Add lightweight client-side caching for project metadata and dashboard data.
- Reduce unnecessary rerenders and network churn.

## 7. Testing and Validation

### 7.1 Unit tests
- Add Rust unit tests for lifecycle validation, decision logic, and rule enforcement.
- Add Python tests for extraction, normalization, and matching functions.
- Add frontend tests for uploader, review, and dashboard states.

### 7.2 Integration tests
- Test the full path: upload → parse → extract → normalize → match → review → commit.
- Validate actual database writes into Supabase and audit generation.
- Cover edge cases such as duplicate files, malformed data, low-confidence matches, and retries.

### 7.3 Golden dataset testing
- Create a benchmark dataset with known good observations and expected matches.
- Test against discipline-specific and multi-discipline scenarios.
- Track precision, recall, and false-positive rates for matching quality.

### 7.4 End-to-end validation
- Run end-to-end scenarios for a realistic project lifecycle.
- Validate review approval and reject flows with actual data.
- Test from dashboard through approval and event output generation.

### 7.5 Regression testing
- Add automated checks for API contracts and database schema changes.
- Run regression validation whenever schema or queue logic changes.
- Keep a reproducible CI process for protected production branches.

## 8. Deployment and Operations

### 8.1 Production environment setup
- Select a deployment target for frontend, backend, and AI services.
- Configure environment variables for dev, staging, and production separately.
- Set up domain routing and TLS certificates.

### 8.2 Container and runtime readiness
- Prepare production Docker builds for frontend, backend, and AI services.
- Add health checks, graceful startup, and readiness endpoints.
- Ensure services can recover from crashes and restarts.

### 8.3 Monitoring and observability
- Add centralized logging for backend and AI service events.
- Set up monitoring dashboards for API health, DB health, queue depth, and processing latency.
- Configure alerts for failures, queue backlogs, storage issues, and critical schema errors.

### 8.4 CI/CD pipeline
- Set up automated linting, build checks, tests, and schema validation.
- Add deployment automation for staging and production.
- Require code review and protected branch rules before merging to main.

### 8.5 Rollback and incident readiness
- Document rollback procedures for frontend, backend, and database changes.
- Define incident response steps for failed imports, queue backlogs, and broken approvals.
- Create operational runbooks for common failures.

## 9. Security, Governance, and Compliance

### 9.1 Secrets management
- Move all keys and secrets into a secure secret manager or environment vault.
- Avoid hardcoding credentials in code or repo files.
- Rotate keys periodically and keep a change log.

### 9.2 RBAC and project access control
- Define strong access boundaries for project roles and cross-project data isolation.
- Review all user flows for unauthorized access or leaked document visibility.

### 9.3 Audit retention and compliance
- Define retention policy for audit logs and evidence documents.
- Confirm legal and operational rules for project data handling.
- Document governance policy for external deployment and client sharing.

### 9.4 Security review
- Review input validation, file upload controls, SQL injection risk, and auth boundaries.
- Harden API endpoints against abuse and malformed requests.
- Add rate limiting and request validation for sensitive endpoints.

## 10. Documentation and Handover

### 10.1 Developer onboarding
- Write a clear local setup guide for frontend, backend, AI service, and Supabase.
- Document exact env variables and required services.
- Create a troubleshooting guide for common issues.

### 10.2 Product documentation
- Finalize user flows, operational overview, architecture notes, and demo instructions.
- Add a deployment runbook and support checklist.

### 10.3 Project readiness checklist
- Confirm MVP feature completeness.
- Confirm security and audit requirements are satisfied.
- Confirm deployment readiness and rollback processes are documented.
- Confirm all demo scenarios can be executed reliably.

## 11. Final Release Gate Before Production

The project is not release-ready until the following are completed:

- [ ] All required API keys and secrets are configured securely
- [ ] Supabase cloud and local env values are fully separated and documented
- [ ] Database schema is complete and validated in cloud Supabase
- [ ] Vector search and embeddings are validated with real data
- [ ] AI extraction and matching pipeline is end-to-end working
- [ ] Trust-layer validation and approvals are enforced
- [ ] Frontend is connected to live APIs and not demo-only data
- [ ] Unit, integration, and regression tests pass
- [ ] Deployment process is configured and tested
- [ ] Security review, RBAC, and audit policy are complete
- [ ] Final project demo and stakeholder flow is rehearsed

## 12. Suggested Execution Order

1. Finish end-to-end data flow and API contracts
2. Complete trust-layer validation and review state enforcement
3. Connect frontend to real APIs and live Supabase data
4. Validate AI extraction and matching against realistic datasets
5. Add integration testing and regression coverage
6. Harden Supabase storage, auth, and permissions
7. Prepare deployment environment and CI/CD pipeline
8. Run security review and operational verification
9. Final demo rehearsal and production readiness signoff

## 13. Immediate Priority Set

The most important tasks right now are:

- finish end-to-end workflow testing
- test Supabase cloud data flow with real project records
- complete review and approval logic
- validate AI extraction and matching quality
- connect app screens to backend APIs and cloud data
- set up CI/CD and deployment readiness
- add security, audit, and operational envelope

This is the current backlog for taking NEXORA AI from prototype foundation to a credible, production-grade infrastructure project intelligence platform.
