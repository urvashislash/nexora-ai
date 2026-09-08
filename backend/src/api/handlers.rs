// =============================================================================
// Backward-compatible re-exports
// =============================================================================
//
// This file originally contained all 1,762 lines of handler logic.
// It has been decomposed into focused modules under `api/`.
// These re-exports ensure that external code (consumer.rs, main.rs, tests)
// continues to compile without modification.
//
// New code should import directly from the specific sub-module.


// --- Application state ---
pub use super::state::AppState;

// --- Health ---
pub use super::health::health_check;

// --- Dashboard ---
pub use super::dashboard::get_dashboard;

// --- Activities & Events ---
pub use super::activities::{get_activities, get_events};

// --- Observations & Ingest ---
pub use super::observations::{create_observation, get_observations, ingest_observations};

// --- Review Queue ---
pub use super::review::get_review_queue;

// --- Proposals (approve, reject, override, batch, comment) ---
pub use super::proposals::{
    add_proposal_comment, approve_proposal, batch_approve_proposals, override_proposal,
    reject_proposal,
};

// --- Audit Trail ---
pub use super::audit::{
    archive_audit_trail, get_audit_retention_policy, get_audit_trail, set_legal_hold,
    verify_audit_chain,
};

// --- Export ---
pub use super::export::export_schedule_p6;

// --- Shared helpers (used by consumer.rs) ---
pub use super::helpers::parse_uuid_or_derive;
