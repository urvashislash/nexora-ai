use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

use crate::domain::models::*;

use super::helpers::PaginationParams;
use super::state::AppState;

// =============================================================================
// Review Queue
// =============================================================================

pub async fn get_review_queue(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(pagination): Query<PaginationParams>,
) -> impl IntoResponse {
    // Try Redis cache first if unpaginated
    if pagination.page.is_none() && pagination.limit.is_none() {
        if let Some(cache) = &state.redis_cache {
            if let Some(cached) = cache
                .get::<serde_json::Value>("review_queue", Some(project_id))
                .await
            {
                tracing::debug!("Review queue cache HIT for project {}", project_id);
                return Json(cached);
            }
        }
    }

    // 2. Query PostgreSQL if database is available
    if let Some(db) = &state.database {
        match db.list_review_queue(project_id).await {
            Ok(items) => {
                let paginated = pagination.apply(&items);
                let value = serde_json::to_value(&paginated).unwrap_or(serde_json::json!([]));
                if pagination.page.is_none() && pagination.limit.is_none() {
                    if let Some(cache) = &state.redis_cache {
                        cache
                            .set(
                                "review_queue",
                                Some(project_id),
                                &value,
                                state.cache_ttl.review_queue_secs,
                            )
                            .await;
                    }
                }
                return Json(value);
            }
            Err(e) => {
                tracing::warn!("Failed to query DB review queue: {}, falling back to in-memory", e);
            }
        }
    }

    // 3. Fallback to in-memory state
    let proposals = state.proposals.read().await;
    let obs = state.observations.read().await;
    let acts = state.activities.read().await;

    let pending: Vec<ReviewQueueItem> = proposals
        .iter()
        .filter(|p| p.project_id == project_id && p.status == "PENDING_REVIEW")
        .map(|p| {
            let observation = obs.iter().find(|o| o.id == p.observation_id).cloned();
            let activity = acts.iter().find(|a| a.id == p.activity_id).cloned();
            ReviewQueueItem {
                proposal: p.clone(),
                observation,
                activity,
            }
        })
        .collect();

    let paginated = pagination.apply(&pending);
    let value = serde_json::to_value(&paginated).unwrap_or(serde_json::json!([]));

    // Cache the result if unpaginated
    if pagination.page.is_none() && pagination.limit.is_none() {
        if let Some(cache) = &state.redis_cache {
            cache
                .set(
                    "review_queue",
                    Some(project_id),
                    &value,
                    state.cache_ttl.review_queue_secs,
                )
                .await;
        }
    }

    Json(value)
}
