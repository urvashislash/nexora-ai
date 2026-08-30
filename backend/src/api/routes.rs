use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use super::handlers::{
    approve_proposal, create_observation, export_schedule_p6, get_activities, get_audit_trail,
    get_dashboard, get_review_queue, reject_proposal, verify_audit_chain, AppState,
};

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/v1/projects/:id/dashboard", get(get_dashboard))
        .route("/api/v1/projects/:id/activities", get(get_activities))
        .route("/api/v1/projects/:id/observations", post(create_observation))
        .route("/api/v1/projects/:id/review-queue", get(get_review_queue))
        .route("/api/v1/proposals/:id/approve", post(approve_proposal))
        .route("/api/v1/proposals/:id/reject", post(reject_proposal))
        .route("/api/v1/projects/:id/audit-trail", get(get_audit_trail))
        .route(
            "/api/v1/projects/:id/audit-trail/verify",
            get(verify_audit_chain),
        )
        .route("/api/v1/projects/:id/export/p6", get(export_schedule_p6))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
