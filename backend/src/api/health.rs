use axum::{
    extract::State,
    response::IntoResponse,
    Json,
};
use chrono::Utc;

use super::state::AppState;

// =============================================================================
// Health Check
// =============================================================================

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

    Json(serde_json::json!({
        "status": "healthy",
        "service": "nexora-trust-plane",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": Utc::now().to_rfc3339(),
        "rabbitmq": rabbit_status,
        "redis": redis_status
    }))
}
