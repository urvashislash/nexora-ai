// =============================================================================
// Project Members Management API
// =============================================================================

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

use crate::api::error::ApiError;
use crate::api::helpers::parse_uuid_or_derive;
use crate::api::middleware::extract_auth_context;
use crate::api::state::AppState;
use crate::domain::models::{ProjectMember, ProjectMemberCreateInput};

/// GET /api/v1/projects/:id/members
pub async fn list_project_members(
    State(state): State<AppState>,
    Path(project_id_raw): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let project_id = parse_uuid_or_derive(&project_id_raw);

    if let Some(ref db) = state.database {
        let members = db
            .list_project_members(project_id)
            .await
            .map_err(|e| ApiError::internal(format!("Failed to list project members: {}", e)))?;
        return Ok(Json(members));
    }

    // In-memory fallback
    let fallback_members = vec![
        ProjectMember {
            id: Uuid::new_v4(),
            project_id,
            user_id: Uuid::new_v4(),
            email: "planner@nexora.ai".to_string(),
            full_name: "Vikram Singh (Lead Planner)".to_string(),
            role: "PLANNER".to_string(),
            is_active: true,
            created_at: chrono::Utc::now(),
        },
        ProjectMember {
            id: Uuid::new_v4(),
            project_id,
            user_id: Uuid::new_v4(),
            email: "admin@nexora.ai".to_string(),
            full_name: "Anita Sharma (Project Director)".to_string(),
            role: "ADMIN".to_string(),
            is_active: true,
            created_at: chrono::Utc::now(),
        },
    ];

    Ok(Json(fallback_members))
}

/// POST /api/v1/projects/:id/members
pub async fn add_project_member(
    State(state): State<AppState>,
    Path(project_id_raw): Path<String>,
    headers: HeaderMap,
    Json(payload): Json<ProjectMemberCreateInput>,
) -> Result<impl IntoResponse, ApiError> {
    let project_id = parse_uuid_or_derive(&project_id_raw);
    let auth = extract_auth_context(&headers);
    let actor_id = auth.as_ref().map(|a| a.user_id);
    let actor_role = auth.as_ref().map(|a| format!("{:?}", a.role));

    let user_id = payload.user_id.unwrap_or_else(Uuid::new_v4);

    if let Some(ref db) = state.database {
        let member = db
            .add_or_update_project_member(
                project_id,
                user_id,
                &payload.email,
                &payload.full_name,
                &payload.role,
                actor_id,
                actor_role.as_deref(),
            )
            .await
            .map_err(|e| ApiError::internal(format!("Failed to add project member: {}", e)))?;

        return Ok((StatusCode::CREATED, Json(member)));
    }

    let member = ProjectMember {
        id: Uuid::new_v4(),
        project_id,
        user_id,
        email: payload.email,
        full_name: payload.full_name,
        role: payload.role,
        is_active: true,
        created_at: chrono::Utc::now(),
    };

    Ok((StatusCode::CREATED, Json(member)))
}

/// DELETE /api/v1/projects/:id/members/:user_id
pub async fn remove_project_member(
    State(state): State<AppState>,
    Path((project_id_raw, user_id_raw)): Path<(String, String)>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let project_id = parse_uuid_or_derive(&project_id_raw);
    let user_id = parse_uuid_or_derive(&user_id_raw);
    let auth = extract_auth_context(&headers);
    let actor_id = auth.as_ref().map(|a| a.user_id);
    let actor_role = auth.as_ref().map(|a| format!("{:?}", a.role));

    if let Some(ref db) = state.database {
        db.deactivate_project_member(project_id, user_id, actor_id, actor_role.as_deref())
            .await
            .map_err(|e| ApiError::internal(format!("Failed to deactivate project member: {}", e)))?;
    }

    Ok(StatusCode::NO_CONTENT)
}
