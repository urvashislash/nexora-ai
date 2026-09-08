use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;

use super::state::AppState;

// =============================================================================
// Health & Readiness Probes (Phase 22)
// =============================================================================

/// Liveness probe: returns 200 if the HTTP process is running.
pub async fn liveness() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "status": "alive",
            "service": "nexora-trust-plane",
            "timestamp": Utc::now().to_rfc3339()
        })),
    )
}

/// Readiness probe: returns 200 if critical dependencies (PostgreSQL) are operational, or 503 otherwise.
pub async fn readiness(State(state): State<AppState>) -> impl IntoResponse {
    let mut is_ready = true;

    let db_status = match &state.database {
        Some(db) => {
            match sqlx::query("SELECT 1").execute(db.pool()).await {
                Ok(_) => "ready",
                Err(e) => {
                    tracing::error!("Readiness check failed on PostgreSQL: {}", e);
                    is_ready = false;
                    "unreachable"
                }
            }
        }
        None => "not_configured",
    };

    let redis_status = match &state.redis_cache {
        Some(cache) => {
            if cache.ping().await {
                "ready"
            } else {
                "unreachable"
            }
        }
        None => "not_configured",
    };

    let rabbit_status = if state.rabbit_publisher.is_some() {
        "ready"
    } else {
        "not_configured"
    };

    let status_code = if is_ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (
        status_code,
        Json(serde_json::json!({
            "status": if is_ready { "ready" } else { "not_ready" },
            "service": "nexora-trust-plane",
            "version": env!("CARGO_PKG_VERSION"),
            "timestamp": Utc::now().to_rfc3339(),
            "dependencies": {
                "database": db_status,
                "redis": redis_status,
                "rabbitmq": rabbit_status
            }
        })),
    )
}

pub async fn health_check(State(state): State<AppState>) -> impl IntoResponse {
    let rabbit_status = if state.rabbit_publisher.is_some() {
        "connected"
    } else {
        "not_configured"
    };

    let redis_status = match &state.redis_cache {
        Some(cache) => {
            if cache.ping().await {
                "connected"
            } else {
                "unreachable"
            }
        }
        None => "not_configured",
    };

    let db_status = if state.database.is_some() {
        "connected"
    } else {
        "not_configured"
    };

    Json(serde_json::json!({
        "status": "healthy",
        "service": "nexora-trust-plane",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": Utc::now().to_rfc3339(),
        "database": db_status,
        "rabbitmq": rabbit_status,
        "redis": redis_status
    }))
}
