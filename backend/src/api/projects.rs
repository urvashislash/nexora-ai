use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use super::error::ApiError;
use super::middleware::extract_auth_context;
use super::state::AppState;
use crate::domain::models::*;

#[derive(Debug, Deserialize, Default)]
pub struct ProjectListParams {
    pub team_id: Option<Uuid>,
}

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
        // Enforce team affiliation and permissions in database mode
        if let Some(team_id) = payload.team_id {
            let team_role = db.verify_team_membership(team_id, auth.user_id).await.map_err(|e| {
                ApiError::internal(format!("Failed to verify team membership: {}", e))
            })?;
            match team_role {
                Some(TeamRole::Owner) | Some(TeamRole::Admin) | Some(TeamRole::Planner) => {},
                _ => return Err(ApiError::not_found("Team not found or caller lacks project creation permissions")),
            }
        }

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

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
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
        team_id: payload.team_id,
        created_at: now,
        updated_at: now,
    };

    let mut projects = state.projects.write().await;
    projects.push(project.clone());

    Ok(Json(project))
}

/// GET /api/v1/projects - Lists tenant-isolated active projects for authenticated caller
pub async fn list_projects(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<ProjectListParams>,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if let Some(ref db) = state.database {
        let projects = db
            .load_user_projects(auth.user_id, params.team_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to load projects from PostgreSQL: {}", e);
                ApiError::internal(format!("Database error: {}", e))
            })?;
        return Ok(Json(projects));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let projects = state.projects.read().await;
    let filtered: Vec<Project> = match params.team_id {
        Some(tid) => projects.iter().filter(|p| p.team_id == Some(tid)).cloned().collect(),
        None => projects.clone(),
    };
    Ok(Json(filtered))
}

/// GET /api/v1/projects/:id - Gets a project by ID
pub async fn get_project(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if let Some(ref db) = state.database {
        let membership = db
            .verify_project_membership(project_id, auth.user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to verify project membership: {}", e);
                ApiError::internal(format!("Database error: {}", e))
            })?;
        if membership.is_none() {
            return Err(ApiError::not_found("Project not found"));
        }

        let project = db.get_project(project_id).await.map_err(|e| {
            tracing::error!("Failed to get project {}: {}", project_id, e);
            ApiError::internal(format!("Database error: {}", e))
        })?;

        let project = project.ok_or_else(|| ApiError::not_found("Project not found"))?;
        return Ok(Json(project));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let projects = state.projects.read().await;
    let project = projects
        .iter()
        .find(|p| p.id == project_id)
        .cloned()
        .ok_or_else(|| ApiError::not_found("Project not found"))?;

    // In-memory tenant isolation check
    if let Some(team_id) = project.team_id {
        let team_members = state.team_members.read().await;
        let is_member = team_members
            .iter()
            .any(|m| m.team_id == team_id && m.user_id == auth.user_id && m.is_active);
        if !is_member {
            return Err(ApiError::not_found("Project not found"));
        }
    }

    Ok(Json(project))
}
