use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
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
                return (axum::http::StatusCode::OK, Json(cached)).into_response();
            }
        }
    }

    let combined: Vec<ActivityWithState> = if let Some(ref db) = state.database {
        match db.list_activities_with_state(project_id).await {
            Ok(acts) => acts,
            Err(e) => {
                tracing::error!("Failed to query activities from database: {}", e);
                return (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": format!("Database error: {}", e),
                        "code": "DATABASE_ERROR"
                    })),
                )
                    .into_response();
            }
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

    Json(value).into_response()
}

/// GET /api/v1/projects/:id/events — list all actual events for a project
pub async fn get_events(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
    Query(pagination): Query<PaginationParams>,
) -> impl IntoResponse {
    let limit = pagination.limit.unwrap_or(50) as i64;
    let page = pagination.page.unwrap_or(1).max(1) as i64;
    let offset = (page - 1) * limit;

    if let Some(ref db) = state.database {
        match db.list_actual_events(project_id, limit, offset).await {
            Ok(events) => {
                let paginated = pagination.apply(&events);
                return (StatusCode::OK, Json(paginated)).into_response();
            }
            Err(e) => {
                tracing::error!("Failed to list actual events from database: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": "Failed to list actual events from database",
                        "details": e.to_string()
                    })),
                )
                    .into_response();
            }
        }
    }

    let is_prod = std::env::var("APP_ENV")
        .or_else(|_| std::env::var("ENVIRONMENT"))
        .map(|v| v.to_lowercase() == "production")
        .unwrap_or(false);
    if is_prod {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "error": "PostgreSQL persistence is mandatory in production environment"
            })),
        )
            .into_response();
    }

    let events = state.events.read().await;
    let filtered: Vec<ActualEvent> = events
        .iter()
        .filter(|e| e.project_id == project_id)
        .cloned()
        .collect();
    let paginated = pagination.apply(&filtered);
    (StatusCode::OK, Json(paginated)).into_response()
}
