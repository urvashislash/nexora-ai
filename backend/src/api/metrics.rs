// =============================================================================
// Operational Metrics Endpoint (Prometheus compatible)
// =============================================================================

use axum::{extract::State, response::IntoResponse};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::Instant;

use crate::api::state::AppState;

static START_TIME: OnceLock<Instant> = OnceLock::new();
static TOTAL_REQUESTS: AtomicU64 = AtomicU64::new(0);

fn get_start_time() -> &'static Instant {
    START_TIME.get_or_init(Instant::now)
}

pub fn increment_request_counter() {
    TOTAL_REQUESTS.fetch_add(1, Ordering::Relaxed);
}

/// GET /metrics and GET /api/v1/metrics
/// Returns Prometheus-formatted operational metrics
pub async fn get_metrics(State(state): State<AppState>) -> impl IntoResponse {
    let uptime_secs = get_start_time().elapsed().as_secs();
    let requests = TOTAL_REQUESTS.load(Ordering::Relaxed);

    let activities_count = state.activities.read().await.len();
    let proposals_count = state.proposals.read().await.len();
    let observations_count = state.observations.read().await.len();
    let audit_events_count = state.audit_trail.read().await.len();

    let db_connected = if state.database.is_some() { 1 } else { 0 };

    let body = format!(
        r#"# HELP nexora_uptime_seconds Total seconds since Rust Trust Plane process started
# TYPE nexora_uptime_seconds counter
nexora_uptime_seconds {}

# HELP nexora_api_requests_total Total API requests served
# TYPE nexora_api_requests_total counter
nexora_api_requests_total {}

# HELP nexora_database_connected 1 if PostgreSQL pool is active, 0 otherwise
# TYPE nexora_database_connected gauge
nexora_database_connected {}

# HELP nexora_activities_active Total activities currently loaded in active state
# TYPE nexora_activities_active gauge
nexora_activities_active {}

# HELP nexora_proposals_active Total proposals in trust plane
# TYPE nexora_proposals_active gauge
nexora_proposals_active {}

# HELP nexora_observations_active Total work observations recorded
# TYPE nexora_observations_active gauge
nexora_observations_active {}

# HELP nexora_audit_events_active Total audit events recorded
# TYPE nexora_audit_events_active gauge
nexora_audit_events_active {}
"#,
        uptime_secs,
        requests,
        db_connected,
        activities_count,
        proposals_count,
        observations_count,
        audit_events_count,
    );

    (
        [("content-type", "text/plain; version=0.0.4; charset=utf-8")],
        body,
    )
}
