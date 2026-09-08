use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use uuid::Uuid;

use crate::domain::models::*;

use super::helpers::PaginationParams;
use super::state::AppState;

// =============================================================================
// Activities
// =============================================================================

pub async fn get_activities(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(pagination): Query<PaginationParams>,
) -> impl IntoResponse {
    // Try Redis cache first if unpaginated
    if pagination.page.is_none() && pagination.limit.is_none() {
        if let Some(cache) = &state.redis_cache {
            if let Some(cached) = cache
                .get::<serde_json::Value>("activities", Some(project_id))
                .await
            {
                tracing::debug!("Activities cache HIT for project {}", project_id);
                return Json(cached);
            }
        }
    }

    let combined: Vec<ActivityWithState> = if let Some(ref db) = state.database {
        if let Ok(acts) = db.list_activities_with_state(project_id).await {
            if !acts.is_empty() {
                acts
            } else {
                let acts = state.activities.read().await;
                let states = state.activity_states.read().await;
                acts.iter()
                    .filter(|a| a.project_id == project_id)
                    .map(|a| {
                        let s = states.iter().find(|st| st.activity_id == a.id).cloned();
                        ActivityWithState {
                            activity: a.clone(),
                            state: s,
                        }
                    })
                    .collect()
            }
        } else {
            let acts = state.activities.read().await;
            let states = state.activity_states.read().await;
            acts.iter()
                .filter(|a| a.project_id == project_id)
                .map(|a| {
                    let s = states.iter().find(|st| st.activity_id == a.id).cloned();
                    ActivityWithState {
                        activity: a.clone(),
                        state: s,
                    }
                })
                .collect()
        }
    } else {
        let acts = state.activities.read().await;
        let states = state.activity_states.read().await;
        acts.iter()
            .filter(|a| a.project_id == project_id)
            .map(|a| {
                let s = states.iter().find(|st| st.activity_id == a.id).cloned();
                ActivityWithState {
                    activity: a.clone(),
                    state: s,
                }
            })
            .collect()
    };

    let paginated = pagination.apply(&combined);
    let value = serde_json::to_value(&paginated).unwrap_or(serde_json::json!([]));

    // Cache the result if unpaginated
    if pagination.page.is_none() && pagination.limit.is_none() {
        if let Some(cache) = &state.redis_cache {
            cache
                .set(
                    "activities",
                    Some(project_id),
                    &value,
                    state.cache_ttl.activities_secs,
                )
                .await;
        }
    }

    Json(value)
}

/// GET /api/v1/projects/:id/events — list all actual events for a project
pub async fn get_events(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(pagination): Query<PaginationParams>,
) -> impl IntoResponse {
    let events = state.events.read().await;
    let filtered: Vec<ActualEvent> = events
        .iter()
        .filter(|e| e.project_id == project_id)
        .cloned()
        .collect();
    let paginated = pagination.apply(&filtered);
    Json(paginated)
}
