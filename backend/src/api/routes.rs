use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use super::handlers::{
    add_proposal_comment, approve_proposal, batch_approve_proposals, export_schedule_p6,
    get_activities, get_audit_trail, get_dashboard, get_review_queue, ingest_observations,
    override_proposal, reject_proposal, AppState,
};

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/v1/projects/:id/dashboard", get(get_dashboard))
        .route("/api/v1/projects/:id/activities", get(get_activities))
        .route("/api/v1/projects/:id/review-queue", get(get_review_queue))
        .route("/api/v1/projects/:id/ingest", post(ingest_observations))
        .route("/api/v1/proposals/:id/approve", post(approve_proposal))
        .route("/api/v1/proposals/:id/override", post(override_proposal))
        .route("/api/v1/proposals/:id/reject", post(reject_proposal))
        .route("/api/v1/proposals/:id/override", post(override_proposal))
        .route("/api/v1/proposals/:id/comment", post(add_proposal_comment))
        .route(
            "/api/v1/proposals/batch-approve",
            post(batch_approve_proposals),
        )
        .route("/api/v1/projects/:id/audit-trail", get(get_audit_trail))
        .route("/api/v1/projects/:id/export/p6", get(export_schedule_p6))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

