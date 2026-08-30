use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;

use super::handlers::{
    add_proposal_comment, approve_proposal, batch_approve_proposals, create_observation,
    export_schedule_p6, get_activities, get_audit_trail, get_dashboard, get_events,
    get_observations, get_review_queue, health_check, ingest_observations, override_proposal,
    reject_proposal, verify_audit_chain, AppState,
};
use super::middleware::{require_permission, Permission};

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // --- Public routes (no auth required) ---
    let public_routes = Router::new().route("/api/v1/health", get(health_check));

    // --- Read-only project routes (ViewProject permission) ---
    let view_project_routes = Router::new()
        .route("/api/v1/projects/:id/dashboard", get(get_dashboard))
        .route("/api/v1/projects/:id/activities", get(get_activities))
        .route("/api/v1/projects/:id/observations", get(get_observations))
        .route("/api/v1/projects/:id/events", get(get_events))
        .route("/api/v1/projects/:id/review-queue", get(get_review_queue))
        .layer(middleware::from_fn(move |req, next| {
            require_permission(req, next, Permission::ViewProject)
        }));

    // --- Observation creation routes (CreateObservation permission) ---
    let observation_routes = Router::new()
        .route("/api/v1/projects/:id/observations", post(create_observation))
        .route("/api/v1/projects/:id/ingest", post(ingest_observations))
        .layer(middleware::from_fn(move |req, next| {
            require_permission(req, next, Permission::CreateObservation)
        }));

    // --- Approval routes (ApproveProposal permission) ---
    let approval_routes = Router::new()
        .route("/api/v1/proposals/:id/approve", post(approve_proposal))
        .route("/api/v1/proposals/:id/reject", post(reject_proposal))
        .route("/api/v1/proposals/:id/comment", post(add_proposal_comment))
        .route(
            "/api/v1/proposals/batch-approve",
            post(batch_approve_proposals),
        )
        .layer(middleware::from_fn(move |req, next| {
            require_permission(req, next, Permission::ApproveProposal)
        }));

    // --- Override routes (OverrideProposal permission) ---
    let override_routes = Router::new()
        .route("/api/v1/proposals/:id/override", post(override_proposal))
        .layer(middleware::from_fn(move |req, next| {
            require_permission(req, next, Permission::OverrideProposal)
        }));

    // --- Audit routes (ViewAudit permission) ---
    let audit_routes = Router::new()
        .route("/api/v1/projects/:id/audit-trail", get(get_audit_trail))
        .route(
            "/api/v1/projects/:id/audit-trail/verify",
            get(verify_audit_chain),
        )
        .layer(middleware::from_fn(move |req, next| {
            require_permission(req, next, Permission::ViewAudit)
        }));

    // --- Export routes (ExportSchedule permission) ---
    let export_routes = Router::new()
        .route("/api/v1/projects/:id/export/p6", get(export_schedule_p6))
        .layer(middleware::from_fn(move |req, next| {
            require_permission(req, next, Permission::ExportSchedule)
        }));

    // Merge all route groups
    Router::new()
        .merge(public_routes)
        .merge(view_project_routes)
        .merge(observation_routes)
        .merge(approval_routes)
        .merge(override_routes)
        .merge(audit_routes)
        .merge(export_routes)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
