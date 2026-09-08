use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::models::*;

use super::state::AppState;

// =============================================================================
// Dashboard & KPIs
// =============================================================================

#[derive(Serialize, Deserialize)]
#[allow(dead_code)]
pub struct DashboardKPIs {
    pub total_observations: usize,
    pub extracted_events: usize,
    pub auto_linked_events: usize,
    pub review_queue_count: usize,
    pub unmatched_count: usize,
    pub completed_activities: usize,
    pub in_progress_activities: usize,
    pub overall_progress_pct: f64,
}

pub async fn get_dashboard(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    // 1. Try Redis cache first
    if let Some(cache) = &state.redis_cache {
        if let Some(cached) = cache
            .get::<DashboardKPIs>("dashboard", Some(project_id))
            .await
        {
            tracing::debug!("Dashboard cache HIT for project {}", project_id);
            return Json(cached);
        }
    }

    // 2. Query PostgreSQL projection truth if available
    if let Some(db) = &state.database {
        match db.get_dashboard_kpis(project_id).await {
            Ok(kpis) => {
                if let Some(cache) = &state.redis_cache {
                    cache
                        .set(
                            "dashboard",
                            Some(project_id),
                            &kpis,
                            state.cache_ttl.dashboard_secs,
                        )
                        .await;
                }
                return Json(kpis);
            }
            Err(e) => {
                tracing::warn!("Failed to query DB dashboard KPIs: {}, falling back to in-memory", e);
            }
        }
    }

    // 3. Fallback to in-memory state
    let obs = state.observations.read().await;
    let proposals = state.proposals.read().await;
    let events = state.events.read().await;
    let act_states = state.activity_states.read().await;

    let auto_linked = proposals
        .iter()
        .filter(|p| p.status == "AUTO_LINKED")
        .count();
    let review_queue = proposals
        .iter()
        .filter(|p| p.status == "PENDING_REVIEW")
        .count();
    let unmatched = proposals
        .iter()
        .filter(|p| p.match_tier == MatchTier::Unmatched)
        .count();
    let completed = act_states
        .iter()
        .filter(|s| s.execution_status == ExecutionStatus::Completed)
        .count();
    let in_progress = act_states
        .iter()
        .filter(|s| s.execution_status == ExecutionStatus::InProgress)
        .count();

    let total_progress: f64 = act_states.iter().map(|s| s.current_progress_pct).sum();
    let overall_pct = if !act_states.is_empty() {
        total_progress / (act_states.len() as f64)
    } else {
        0.0
    };

    let kpis = DashboardKPIs {
        total_observations: obs.len(),
        extracted_events: events.len(),
        auto_linked_events: auto_linked,
        review_queue_count: review_queue,
        unmatched_count: unmatched,
        completed_activities: completed,
        in_progress_activities: in_progress,
        overall_progress_pct: (overall_pct * 100.0).round() / 100.0,
    };

    // Cache the result
    if let Some(cache) = &state.redis_cache {
        cache
            .set(
                "dashboard",
                Some(project_id),
                &kpis,
                state.cache_ttl.dashboard_secs,
            )
            .await;
    }

    Json(kpis)
}
