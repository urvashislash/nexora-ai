use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use tower_http::cors::{CorsLayer, AllowOrigin};
use axum::http::{header, HeaderValue, HeaderName};
use std::env;
use tower_http::trace::TraceLayer;

use super::handlers::{
    add_proposal_comment, approve_proposal, archive_audit_trail, batch_approve_proposals,
    create_observation, export_schedule_p6, get_activities, get_audit_retention_policy,
    get_audit_trail, get_dashboard, get_events, get_observations, get_review_queue, health_check,
    ingest_observations, override_proposal, reject_proposal, set_legal_hold, verify_audit_chain,
    AppState,
};
use super::middleware::{require_permission, security_headers_middleware, Permission};

pub fn create_router(state: AppState) -> Router {
    // Restrictive CORS configuration
    let allowed_origins: Vec<HeaderValue> = env::var("ALLOWED_ORIGINS")
        .ok()
        .and_then(|s| {
            if s.is_empty() {
                None
            } else {
                Some(s.split(',').map(|s| {
                    let origin = s.trim().to_string();
                    HeaderValue::from_str(&origin).unwrap_or_else(|_| HeaderValue::from_static("http://localhost:5173"))
                }).collect::<Vec<_>>())
            }
        })
        .unwrap_or_else(|| vec![
            HeaderValue::from_static("http://localhost:5173"),
            HeaderValue::from_static("http://localhost:3000"),
        ]);
    
    let mut cors = CorsLayer::new();
    for origin in allowed_origins {
        cors = cors.allow_origin(AllowOrigin::exact(origin));
    }
    
    cors = cors
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::PATCH,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
            HeaderName::from_static("x-user-id"),
            HeaderName::from_static("x-user-role"),
        ])
        .allow_credentials(true)
        .max_age(std::time::Duration::from_secs(86400));

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
        .route(
            "/api/v1/projects/:id/observations",
            post(create_observation),
        )
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
        .route(
            "/api/v1/projects/:id/audit-trail/retention-policy",
            get(get_audit_retention_policy),
        )
        .layer(middleware::from_fn(move |req, next| {
            require_permission(req, next, Permission::ViewAudit)
        }));

    // --- Retention & Legal Hold Governance routes (ManageRetention permission) ---
    let governance_routes = Router::new()
        .route(
            "/api/v1/projects/:id/audit-trail/legal-hold",
            post(set_legal_hold),
        )
        .route(
            "/api/v1/projects/:id/audit-trail/archive",
            post(archive_audit_trail),
        )
        .layer(middleware::from_fn(move |req, next| {
            require_permission(req, next, Permission::ManageRetention)
        }));

    // --- Export routes (ExportSchedule permission) ---
    let export_routes = Router::new()
        .route("/api/v1/projects/:id/export/p6", get(export_schedule_p6))
        .layer(middleware::from_fn(move |req, next| {
            require_permission(req, next, Permission::ExportSchedule)
        }));

    // Merge all route groups and apply global security middlewares
    Router::new()
        .merge(public_routes)
        .merge(view_project_routes)
        .merge(observation_routes)
        .merge(approval_routes)
        .merge(override_routes)
        .merge(audit_routes)
        .merge(governance_routes)
        .merge(export_routes)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(middleware::from_fn(security_headers_middleware))
        .with_state(state)
}
