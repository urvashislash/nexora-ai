use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

use super::error::ApiError;
use super::middleware::extract_auth_context;
use super::state::AppState;
use crate::domain::models::*;

/// POST /api/v1/projects - Transactionally creates a new project
pub async fn create_project(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ProjectCreateInput>,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if payload.code.trim().is_empty() {
        return Err(ApiError::validation("Project code cannot be empty"));
    }
    if payload.name.trim().is_empty() {
        return Err(ApiError::validation("Project name cannot be empty"));
    }

    if let Some(ref db) = state.database {
        match db
            .create_project_tx(
                &payload,
                auth.user_id,
                auth.email.as_deref(),
                auth.full_name.as_deref(),
            )
            .await
        {
            Ok(project) => {
                let mut projects = state.projects.write().await;
                if !projects.iter().any(|p| p.id == project.id) {
                    projects.push(project.clone());
                }
                return Ok(Json(project));
            }
            Err(e) => {
                tracing::error!("Database project creation failed: {}", e);
                return Err(ApiError::internal(format!(
                    "Failed to create project: {}",
                    e
                )));
            }
        }
    }

    let is_prod = std::env::var("APP_ENV")
        .or_else(|_| std::env::var("ENVIRONMENT"))
        .map(|v| v.to_lowercase() == "production")
        .unwrap_or(false);
    if is_prod {
        return Err(ApiError::internal(
            "PostgreSQL persistence is mandatory in production environment",
        ));
    }

    // In-memory fallback (only for offline unit test mode without database)
    let project_id = Uuid::new_v4();
    let now = chrono::Utc::now();
    let project = Project {
        id: project_id,
        code: payload.code.trim().to_uppercase(),
        name: payload.name.trim().to_string(),
        description: payload.description,
        timezone: payload
            .timezone
            .unwrap_or_else(|| "Asia/Kolkata".to_string()),
        currency: payload.currency.unwrap_or_else(|| "INR".to_string()),
        created_at: now,
        updated_at: now,
    };

    let mut projects = state.projects.write().await;
    projects.push(project.clone());

    Ok(Json(project))
}

/// GET /api/v1/projects - Lists all active projects
pub async fn list_projects(State(state): State<AppState>) -> Result<impl IntoResponse, ApiError> {
    if let Some(ref db) = state.database {
        let projects = db.load_projects().await.map_err(|e| {
            tracing::error!("Failed to load projects from PostgreSQL: {}", e);
            ApiError::internal(format!("Database error: {}", e))
        })?;
        return Ok(Json(projects));
    }

    let projects = state.projects.read().await;
    Ok(Json(projects.clone()))
}

/// GET /api/v1/projects/:id - Gets a project by ID
pub async fn get_project(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    if let Some(ref db) = state.database {
        let project = db.get_project(project_id).await.map_err(|e| {
            tracing::error!("Failed to get project {}: {}", project_id, e);
            ApiError::internal(format!("Database error: {}", e))
        })?;

        let project = project.ok_or_else(|| ApiError::not_found("Project not found"))?;
        return Ok(Json(project));
    }

    let projects = state.projects.read().await;
    let project = projects
        .iter()
        .find(|p| p.id == project_id)
        .cloned()
        .ok_or_else(|| ApiError::not_found("Project not found"))?;

    Ok(Json(project))
}
