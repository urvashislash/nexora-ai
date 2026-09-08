use axum::http::{header, HeaderValue};
use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use std::env;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use super::handlers::{
    add_proposal_comment, approve_proposal, archive_audit_trail, batch_approve_proposals,
    create_observation, export_schedule_p6, get_activities, get_audit_retention_policy,
    get_audit_trail, get_dashboard, get_events, get_observations, get_review_queue, health_check,
    ingest_observations, override_proposal, reject_proposal, set_legal_hold, verify_audit_chain,
    AppState,
};
use super::middleware::{
    require_permission, require_project_permission, security_headers_middleware, Permission,
    RateLimitMiddleware,
};

pub fn create_router(state: AppState) -> Router {
    let rate_limiter = RateLimitMiddleware::new(
        env::var("RATE_LIMIT_MAX_REQUESTS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(200),
        std::time::Duration::from_secs(60),
    )
    .with_redis(state.redis_cache.clone());
    // Restrictive CORS configuration
    let allowed_origins: Vec<HeaderValue> = env::var("ALLOWED_ORIGINS")
        .ok()
        .and_then(|s| {
            if s.is_empty() {
                None
            } else {
                Some(
                    s.split(',')
                        .map(|s| {
                            let origin = s.trim().to_string();
                            HeaderValue::from_str(&origin).unwrap_or_else(|_| {
                                HeaderValue::from_static("http://localhost:5173")
                            })
                        })
                        .collect::<Vec<_>>(),
                )
            }
        })
        .unwrap_or_else(|| {
            vec![
                HeaderValue::from_static("http://localhost:5173"),
                HeaderValue::from_static("http://127.0.0.1:5173"),
                HeaderValue::from_static("http://localhost:8080"),
                HeaderValue::from_static("http://127.0.0.1:8080"),
            ]
        });

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(move |origin: &HeaderValue, _| {
            allowed_origins.contains(origin)
        }))
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::PATCH,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, header::ACCEPT])
        .allow_credentials(true)
        .max_age(std::time::Duration::from_secs(86400));

    // --- Public routes (no auth required) ---
    let public_routes = Router::new()
        .route("/api/v1/health", get(health_check))
        .route("/liveness", get(super::health::liveness))
        .route("/readiness", get(super::health::readiness))
        .route("/api/v1/health/liveness", get(super::health::liveness))
        .route("/api/v1/health/readiness", get(super::health::readiness))
        .route("/metrics", get(super::metrics::get_metrics))
        .route("/api/v1/metrics", get(super::metrics::get_metrics));

    // --- Authentication & Profile routes ---
    let auth_routes = Router::new().route("/api/v1/auth/me", get(super::auth::get_me));

    // --- Read-only project routes (ViewProject permission with project membership) ---
    let st = state.clone();
    let view_project_routes = Router::new()
        .route("/api/v1/projects/:id/dashboard", get(get_dashboard))
        .route("/api/v1/projects/:id/activities", get(get_activities))
        .route("/api/v1/projects/:id/observations", get(get_observations))
        .route("/api/v1/projects/:id/events", get(get_events))
        .route("/api/v1/projects/:id/review-queue", get(get_review_queue))
        .route(
            "/api/v1/projects/:id/members",
            get(super::members::list_project_members),
        )
        .route(
            "/api/v1/projects/:id/import/preview",
            post(super::import::preview_schedule_import),
        )
        .layer(middleware::from_fn(move |req, next| {
            require_project_permission(st.clone(), req, next, Permission::ViewProject)
        }));

    // --- Project Administration routes (Admin permission with project membership) ---
    let st = state.clone();
    let project_admin_routes = Router::new()
        .route(
            "/api/v1/projects/:id/members",
            post(super::members::add_project_member),
        )
        .route(
            "/api/v1/projects/:id/members/:user_id",
            axum::routing::delete(super::members::remove_project_member),
        )
        .layer(middleware::from_fn(move |req, next| {
            require_project_permission(st.clone(), req, next, Permission::Admin)
        }));

    // --- Schedule Planning & Import commit routes (Planner permission with project membership) ---
    let st = state.clone();
    let schedule_planner_routes = Router::new()
        .route(
            "/api/v1/projects/:id/import/commit",
            post(super::import::commit_schedule_import),
        )
        .layer(middleware::from_fn(move |req, next| {
            require_project_permission(st.clone(), req, next, Permission::ApproveProposal)
        }));

    // --- Document and Durable Job routes (CreateObservation permission with project membership) ---
    let st = state.clone();
    let document_routes = Router::new()
        .route(
            "/api/v1/projects/:id/documents",
            get(super::documents::list_documents).post(super::documents::create_document),
        )
        .route("/api/v1/jobs/:id", get(super::documents::get_job))
        .layer(middleware::from_fn(move |req, next| {
            require_project_permission(st.clone(), req, next, Permission::CreateObservation)
        }));

    // --- Observation creation routes (CreateObservation permission with project membership) ---
    let st = state.clone();
    let observation_routes = Router::new()
        .route(
            "/api/v1/projects/:id/observations",
            post(create_observation),
        )
        .route("/api/v1/projects/:id/ingest", post(ingest_observations))
        .layer(middleware::from_fn(move |req, next| {
            require_project_permission(st.clone(), req, next, Permission::CreateObservation)
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

    // --- Audit routes (ViewAudit permission with project membership) ---
    let st = state.clone();
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
            require_project_permission(st.clone(), req, next, Permission::ViewAudit)
        }));

    // --- Retention & Legal Hold Governance routes (ManageRetention permission with project membership) ---
    let st = state.clone();
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
            require_project_permission(st.clone(), req, next, Permission::ManageRetention)
        }));

    // --- Export routes (ExportSchedule permission with project membership) ---
    let st = state.clone();
    let export_routes = Router::new()
        .route("/api/v1/projects/:id/export/p6", get(export_schedule_p6))
        .layer(middleware::from_fn(move |req, next| {
            require_project_permission(st.clone(), req, next, Permission::ExportSchedule)
        }));

    // --- Project management routes (authenticated and tenant-isolated) ---
    let st = state.clone();
    let project_routes = Router::new()
        .route(
            "/api/v1/projects",
            get(super::projects::list_projects).post(super::projects::create_project),
        )
        .route("/api/v1/projects/:id", get(super::projects::get_project))
        .layer(middleware::from_fn(move |req, next| {
            require_project_permission(st.clone(), req, next, Permission::ViewProject)
        }));

    // Merge all route groups and apply global security middlewares
    Router::new()
        .merge(public_routes)
        .merge(auth_routes)
        .merge(project_routes)
        .merge(project_admin_routes)
        .merge(schedule_planner_routes)
        .merge(view_project_routes)
        .merge(document_routes)
        .merge(observation_routes)
        .merge(approval_routes)
        .merge(override_routes)
        .merge(audit_routes)
        .merge(governance_routes)
        .merge(export_routes)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(middleware::from_fn(security_headers_middleware))
        .layer(middleware::from_fn(move |req, next| {
            rate_limiter.clone().handle_rate_limit(req, next)
        }))
        .with_state(state)
}
