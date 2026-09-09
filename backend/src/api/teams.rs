use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::error::ApiError;
use super::middleware::extract_auth_context;
use super::state::AppState;
use crate::domain::models::*;

#[derive(Debug, Deserialize)]
pub struct DeleteTeamPayload {
    pub confirm_name: String,
}

#[derive(Debug, Deserialize)]
pub struct TransferOwnershipPayload {
    pub new_owner_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct SuccessResponse {
    pub success: bool,
    pub message: String,
}

async fn check_in_memory_team_role(
    state: &AppState,
    team_id: Uuid,
    user_id: Uuid,
) -> Option<TeamRole> {
    let members = state.team_members.read().await;
    members
        .iter()
        .find(|m| m.team_id == team_id && m.user_id == user_id && m.is_active)
        .and_then(|m| TeamRole::from_str(&m.role))
}

/// POST /api/v1/teams — Creates a team and makes caller OWNER
pub async fn create_team(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<TeamCreateInput>,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if payload.name.trim().is_empty() {
        return Err(ApiError::bad_request("Team name cannot be empty"));
    }

    if let Some(ref db) = state.database {
        let team = db
            .create_team_tx(
                &payload,
                auth.user_id,
                auth.email.as_deref(),
                auth.full_name.as_deref(),
            )
            .await
            .map_err(|e| ApiError::internal(format!("Failed to create team: {}", e)))?;
        return Ok((StatusCode::CREATED, Json(team)));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    // In-memory fallback for offline test mode
    let team_id = Uuid::new_v4();
    let now = chrono::Utc::now();
    let slug = payload.slug.clone().unwrap_or_else(|| {
        let s: String = payload
            .name
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '-' })
            .collect();
        let trimmed = s.trim_matches('-').to_string();
        if trimmed.is_empty() {
            format!("team-{}", &team_id.to_string()[..8])
        } else {
            trimmed
        }
    });

    let team = Team {
        id: team_id,
        name: payload.name.clone(),
        slug,
        created_by: auth.user_id,
        created_at: now,
        updated_at: now,
    };

    let member = TeamMember {
        id: Uuid::new_v4(),
        team_id,
        user_id: auth.user_id,
        email: auth.email.clone(),
        full_name: auth.full_name.clone(),
        role: "OWNER".to_string(),
        is_active: true,
        created_at: now,
        updated_at: now,
    };

    state.teams.write().await.push(team.clone());
    state.team_members.write().await.push(member);

    Ok((StatusCode::CREATED, Json(team)))
}

/// GET /api/v1/teams — Lists all teams for the authenticated caller
pub async fn list_teams(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if let Some(ref db) = state.database {
        let teams = db
            .load_user_teams(auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Failed to load teams: {}", e)))?;
        return Ok(Json(teams));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    // In-memory fallback
    let members = state.team_members.read().await;
    let user_team_ids: Vec<Uuid> = members
        .iter()
        .filter(|m| m.user_id == auth.user_id && m.is_active)
        .map(|m| m.team_id)
        .collect();

    let teams = state.teams.read().await;
    let user_teams: Vec<Team> = teams
        .iter()
        .filter(|t| user_team_ids.contains(&t.id))
        .cloned()
        .collect();

    Ok(Json(user_teams))
}

/// GET /api/v1/teams/:id — Fetches team by ID (verifying membership)
pub async fn get_team(
    State(state): State<AppState>,
    Path(team_id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if let Some(ref db) = state.database {
        let membership = db
            .verify_team_membership(team_id, auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;

        if membership.is_none() {
            return Err(ApiError::not_found("Team not found"));
        }

        let team = db
            .get_team(team_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?
            .ok_or_else(|| ApiError::not_found("Team not found"))?;

        return Ok(Json(team));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let caller_role = check_in_memory_team_role(&state, team_id, auth.user_id).await;
    if caller_role.is_none() {
        return Err(ApiError::not_found("Team not found"));
    }

    let teams = state.teams.read().await;
    let team = teams
        .iter()
        .find(|t| t.id == team_id)
        .cloned()
        .ok_or_else(|| ApiError::not_found("Team not found"))?;

    Ok(Json(team))
}

/// PUT /api/v1/teams/:id — Updates team name (Owner or Admin only)
pub async fn update_team(
    State(state): State<AppState>,
    Path(team_id): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<TeamUpdateInput>,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    let new_name = payload
        .name
        .filter(|n| !n.trim().is_empty())
        .ok_or_else(|| ApiError::bad_request("Team name cannot be empty"))?;

    if let Some(ref db) = state.database {
        let role = db
            .verify_team_membership(team_id, auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;

        match role {
            Some(TeamRole::Owner) | Some(TeamRole::Admin) => {}
            _ => {
                return Err(ApiError::forbidden(
                    "Only team Owner or Admin can update team settings",
                ));
            }
        }

        let team = db
            .update_team(team_id, &new_name)
            .await
            .map_err(|e| ApiError::internal(format!("Failed to update team: {}", e)))?;
        return Ok(Json(team));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let caller_role = check_in_memory_team_role(&state, team_id, auth.user_id).await;
    match caller_role {
        Some(TeamRole::Owner) | Some(TeamRole::Admin) => {}
        _ => {
            return Err(ApiError::forbidden(
                "Only team Owner or Admin can update team settings",
            ));
        }
    }

    let mut teams = state.teams.write().await;
    let team = teams
        .iter_mut()
        .find(|t| t.id == team_id)
        .ok_or_else(|| ApiError::not_found("Team not found"))?;
    team.name = new_name;
    team.updated_at = chrono::Utc::now();

    Ok(Json(team.clone()))
}

/// DELETE /api/v1/teams/:id — Deletes team (Owner only, requires name confirmation)
pub async fn delete_team(
    State(state): State<AppState>,
    Path(team_id): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<DeleteTeamPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if let Some(ref db) = state.database {
        let role = db
            .verify_team_membership(team_id, auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;

        if role != Some(TeamRole::Owner) {
            return Err(ApiError::forbidden("Only the team Owner can delete a team"));
        }

        db.delete_team_tx(team_id, &payload.confirm_name)
            .await
            .map_err(|e| ApiError::bad_request(format!("Cannot delete team: {}", e)))?;

        return Ok(Json(SuccessResponse {
            success: true,
            message: "Team deleted successfully".to_string(),
        }));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let caller_role = check_in_memory_team_role(&state, team_id, auth.user_id).await;
    if caller_role != Some(TeamRole::Owner) {
        return Err(ApiError::forbidden("Only the team Owner can delete a team"));
    }

    let mut teams = state.teams.write().await;
    let index = teams
        .iter()
        .position(|t| t.id == team_id && t.name == payload.confirm_name)
        .ok_or_else(|| ApiError::bad_request("Team name confirmation mismatch or team not found"))?;

    teams.remove(index);

    Ok(Json(SuccessResponse {
        success: true,
        message: "Team deleted successfully".to_string(),
    }))
}

/// GET /api/v1/teams/:id/members — Lists members of a team
pub async fn list_team_members(
    State(state): State<AppState>,
    Path(team_id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if let Some(ref db) = state.database {
        let role = db
            .verify_team_membership(team_id, auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;

        if role.is_none() {
            return Err(ApiError::not_found("Team not found"));
        }

        let members = db
            .list_team_members(team_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;
        return Ok(Json(members));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let caller_role = check_in_memory_team_role(&state, team_id, auth.user_id).await;
    if caller_role.is_none() {
        return Err(ApiError::not_found("Team not found"));
    }

    let members = state.team_members.read().await;
    let team_members: Vec<TeamMember> = members
        .iter()
        .filter(|m| m.team_id == team_id && m.is_active)
        .cloned()
        .collect();

    Ok(Json(team_members))
}

/// PUT /api/v1/teams/:id/members/:user_id — Updates a member's role (Owner or Admin only)
pub async fn update_team_member_role(
    State(state): State<AppState>,
    Path((team_id, target_user_id)): Path<(Uuid, Uuid)>,
    headers: HeaderMap,
    Json(payload): Json<TeamMemberRoleUpdateInput>,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    let new_role = TeamRole::from_str(&payload.role)
        .ok_or_else(|| ApiError::bad_request(format!("Invalid team role: {}", payload.role)))?;

    if new_role == TeamRole::Owner {
        return Err(ApiError::bad_request(
            "Cannot assign OWNER role directly. Use transfer-ownership instead",
        ));
    }

    if let Some(ref db) = state.database {
        let caller_role = db
            .verify_team_membership(team_id, auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;

        match caller_role {
            Some(TeamRole::Owner) | Some(TeamRole::Admin) => {}
            _ => {
                return Err(ApiError::forbidden(
                    "Only team Owner or Admin can update member roles",
                ));
            }
        }

        db.update_team_member_role(team_id, target_user_id, new_role.as_str())
            .await
            .map_err(|e| ApiError::internal(format!("Failed to update member role: {}", e)))?;

        return Ok(Json(SuccessResponse {
            success: true,
            message: "Member role updated successfully".to_string(),
        }));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let caller_role = check_in_memory_team_role(&state, team_id, auth.user_id).await;
    match caller_role {
        Some(TeamRole::Owner) | Some(TeamRole::Admin) => {}
        _ => {
            return Err(ApiError::forbidden(
                "Only team Owner or Admin can update member roles",
            ));
        }
    }

    let mut members = state.team_members.write().await;
    let member = members
        .iter_mut()
        .find(|m| m.team_id == team_id && m.user_id == target_user_id)
        .ok_or_else(|| ApiError::not_found("Team member not found"))?;
    member.role = new_role.as_str().to_string();
    member.updated_at = chrono::Utc::now();

    Ok(Json(SuccessResponse {
        success: true,
        message: "Member role updated successfully".to_string(),
    }))
}

/// DELETE /api/v1/teams/:id/members/:user_id — Removes member from team (Owner or Admin only)
pub async fn remove_team_member(
    State(state): State<AppState>,
    Path((team_id, target_user_id)): Path<(Uuid, Uuid)>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if let Some(ref db) = state.database {
        let caller_role = db
            .verify_team_membership(team_id, auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;

        match caller_role {
            Some(TeamRole::Owner) | Some(TeamRole::Admin) => {}
            _ => {
                return Err(ApiError::forbidden(
                    "Only team Owner or Admin can remove members",
                ));
            }
        }

        // Cannot remove owner
        let target_role = db
            .verify_team_membership(team_id, target_user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;
        if target_role == Some(TeamRole::Owner) {
            return Err(ApiError::bad_request(
                "Cannot remove the team Owner. Transfer ownership before removing",
            ));
        }

        db.remove_team_member(team_id, target_user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Failed to remove team member: {}", e)))?;

        return Ok(Json(SuccessResponse {
            success: true,
            message: "Member removed from team".to_string(),
        }));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let caller_role = check_in_memory_team_role(&state, team_id, auth.user_id).await;
    match caller_role {
        Some(TeamRole::Owner) | Some(TeamRole::Admin) => {}
        _ => {
            return Err(ApiError::forbidden(
                "Only team Owner or Admin can remove members",
            ));
        }
    }

    let mut members = state.team_members.write().await;
    members.retain(|m| !(m.team_id == team_id && m.user_id == target_user_id));

    Ok(Json(SuccessResponse {
        success: true,
        message: "Member removed from team".to_string(),
    }))
}

/// POST /api/v1/teams/:id/transfer-ownership — Transfers team ownership (Owner only)
pub async fn transfer_team_ownership(
    State(state): State<AppState>,
    Path(team_id): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<TransferOwnershipPayload>,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if let Some(ref db) = state.database {
        db.transfer_team_ownership_tx(team_id, auth.user_id, payload.new_owner_id)
            .await
            .map_err(|e| ApiError::bad_request(format!("Cannot transfer ownership: {}", e)))?;

        return Ok(Json(SuccessResponse {
            success: true,
            message: "Team ownership transferred successfully".to_string(),
        }));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let caller_role = check_in_memory_team_role(&state, team_id, auth.user_id).await;
    if caller_role != Some(TeamRole::Owner) {
        return Err(ApiError::forbidden("Only the current Owner can transfer team ownership"));
    }

    let mut members = state.team_members.write().await;
    if let Some(old_owner) = members.iter_mut().find(|m| m.team_id == team_id && m.user_id == auth.user_id) {
        old_owner.role = "ADMIN".to_string();
    }
    if let Some(new_owner) = members.iter_mut().find(|m| m.team_id == team_id && m.user_id == payload.new_owner_id) {
        new_owner.role = "OWNER".to_string();
    }

    Ok(Json(SuccessResponse {
        success: true,
        message: "Team ownership transferred successfully".to_string(),
    }))
}

/// POST /api/v1/teams/:id/leave — Leaves team (non-owner members)
pub async fn leave_team(
    State(state): State<AppState>,
    Path(team_id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if let Some(ref db) = state.database {
        let role = db
            .verify_team_membership(team_id, auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;

        if role == Some(TeamRole::Owner) {
            return Err(ApiError::bad_request(
                "Team owner cannot leave the team without transferring ownership or deleting the team",
            ));
        }

        db.remove_team_member(team_id, auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Failed to leave team: {}", e)))?;

        return Ok(Json(SuccessResponse {
            success: true,
            message: "Left team successfully".to_string(),
        }));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let mut members = state.team_members.write().await;
    members.retain(|m| !(m.team_id == team_id && m.user_id == auth.user_id));

    Ok(Json(SuccessResponse {
        success: true,
        message: "Left team successfully".to_string(),
    }))
}

/// GET /api/v1/teams/:id/projects — Lists projects belonging to a team
pub async fn list_team_projects(
    State(state): State<AppState>,
    Path(team_id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if let Some(ref db) = state.database {
        let role = db
            .verify_team_membership(team_id, auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;

        if role.is_none() {
            return Err(ApiError::not_found("Team not found"));
        }

        let projects = db
            .load_team_projects(team_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;
        return Ok(Json(projects));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let caller_role = check_in_memory_team_role(&state, team_id, auth.user_id).await;
    if caller_role.is_none() {
        return Err(ApiError::not_found("Team not found"));
    }

    let projects = state.projects.read().await;
    let team_projects: Vec<Project> = projects
        .iter()
        .filter(|p| p.team_id == Some(team_id))
        .cloned()
        .collect();

    Ok(Json(team_projects))
}

/// POST /api/v1/teams/:id/projects — Creates a project inside a team
pub async fn create_team_project(
    State(state): State<AppState>,
    Path(team_id): Path<Uuid>,
    headers: HeaderMap,
    Json(mut payload): Json<ProjectCreateInput>,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    payload.team_id = Some(team_id);

    if let Some(ref db) = state.database {
        let role = db
            .verify_team_membership(team_id, auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;

        match role {
            Some(TeamRole::Owner) | Some(TeamRole::Admin) | Some(TeamRole::Planner) => {}
            _ => {
                return Err(ApiError::forbidden(
                    "Only team Owner, Admin, or Planner can create projects in this team",
                ));
            }
        }

        let project = db
            .create_project_tx(
                &payload,
                auth.user_id,
                auth.email.as_deref(),
                auth.full_name.as_deref(),
            )
            .await
            .map_err(|e| ApiError::internal(format!("Failed to create project: {}", e)))?;

        return Ok((StatusCode::CREATED, Json(project)));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let caller_role = check_in_memory_team_role(&state, team_id, auth.user_id).await;
    match caller_role {
        Some(TeamRole::Owner) | Some(TeamRole::Admin) | Some(TeamRole::Planner) => {}
        _ => {
            return Err(ApiError::forbidden(
                "Only team Owner, Admin, or Planner can create projects in this team",
            ));
        }
    }

    // In-memory fallback
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
        team_id: Some(team_id),
        created_at: now,
        updated_at: now,
    };

    state.projects.write().await.push(project.clone());

    Ok((StatusCode::CREATED, Json(project)))
}

/// POST /api/v1/teams/:id/invitations — Sends invitation (Owner or Admin only)
pub async fn create_team_invitation(
    State(state): State<AppState>,
    Path(team_id): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<TeamInviteInput>,
) -> Result<impl IntoResponse, ApiError> {
    if std::env::var("FEATURE_TEAM_INVITES")
        .map(|v| v == "false" || v == "0")
        .unwrap_or(false)
    {
        return Err(ApiError::service_unavailable(
            "Team invitations are temporarily disabled via feature flag",
        ));
    }

    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    let role = TeamRole::from_str(&payload.role)
        .ok_or_else(|| ApiError::bad_request(format!("Invalid invited role: {}", payload.role)))?;

    if role == TeamRole::Owner {
        return Err(ApiError::bad_request(
            "Cannot invite user as OWNER. Invite as Admin instead",
        ));
    }

    if let Some(ref db) = state.database {
        let caller_role = db
            .verify_team_membership(team_id, auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;

        match caller_role {
            Some(TeamRole::Owner) | Some(TeamRole::Admin) => {}
            _ => {
                return Err(ApiError::forbidden(
                    "Only team Owner or Admin can send invitations",
                ));
            }
        }

        let inv = db
            .create_team_invitation(team_id, &payload.email, role.as_str(), auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Failed to create invitation: {}", e)))?;

        return Ok((StatusCode::CREATED, Json(inv)));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let caller_role = check_in_memory_team_role(&state, team_id, auth.user_id).await;
    match caller_role {
        Some(TeamRole::Owner) | Some(TeamRole::Admin) => {}
        _ => {
            return Err(ApiError::forbidden(
                "Only team Owner or Admin can send invitations",
            ));
        }
    }

    let inv_id = Uuid::new_v4();
    let token = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
    let now = chrono::Utc::now();
    let inv = TeamInvitation {
        id: inv_id,
        team_id,
        email: payload.email,
        role: role.as_str().to_string(),
        token,
        status: "PENDING".to_string(),
        invited_by: auth.user_id,
        expires_at: now + chrono::Duration::days(7),
        created_at: now,
        updated_at: now,
    };

    state.team_invitations.write().await.push(inv.clone());

    Ok((StatusCode::CREATED, Json(inv)))
}

/// GET /api/v1/teams/:id/invitations — Lists active pending invitations
pub async fn list_team_invitations(
    State(state): State<AppState>,
    Path(team_id): Path<Uuid>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if let Some(ref db) = state.database {
        let role = db
            .verify_team_membership(team_id, auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;

        match role {
            Some(TeamRole::Owner) | Some(TeamRole::Admin) => {}
            _ => {
                return Err(ApiError::forbidden(
                    "Only team Owner or Admin can view invitations",
                ));
            }
        }

        let invs = db
            .list_team_invitations(team_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;
        return Ok(Json(invs));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let caller_role = check_in_memory_team_role(&state, team_id, auth.user_id).await;
    match caller_role {
        Some(TeamRole::Owner) | Some(TeamRole::Admin) => {}
        _ => {
            return Err(ApiError::forbidden(
                "Only team Owner or Admin can view invitations",
            ));
        }
    }

    let invs = state.team_invitations.read().await;
    let pending: Vec<TeamInvitation> = invs
        .iter()
        .filter(|i| i.team_id == team_id && i.status == "PENDING")
        .cloned()
        .collect();

    Ok(Json(pending))
}

/// DELETE /api/v1/teams/:id/invitations/:inv_id — Revokes invitation
pub async fn revoke_team_invitation(
    State(state): State<AppState>,
    Path((team_id, inv_id)): Path<(Uuid, Uuid)>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if let Some(ref db) = state.database {
        let role = db
            .verify_team_membership(team_id, auth.user_id)
            .await
            .map_err(|e| ApiError::internal(format!("Database error: {}", e)))?;

        match role {
            Some(TeamRole::Owner) | Some(TeamRole::Admin) => {}
            _ => {
                return Err(ApiError::forbidden(
                    "Only team Owner or Admin can revoke invitations",
                ));
            }
        }

        db.revoke_team_invitation(team_id, inv_id)
            .await
            .map_err(|e| ApiError::internal(format!("Failed to revoke invitation: {}", e)))?;

        return Ok(Json(SuccessResponse {
            success: true,
            message: "Invitation revoked".to_string(),
        }));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let caller_role = check_in_memory_team_role(&state, team_id, auth.user_id).await;
    match caller_role {
        Some(TeamRole::Owner) | Some(TeamRole::Admin) => {}
        _ => {
            return Err(ApiError::forbidden(
                "Only team Owner or Admin can revoke invitations",
            ));
        }
    }

    let mut invs = state.team_invitations.write().await;
    if let Some(inv) = invs
        .iter_mut()
        .find(|i| i.team_id == team_id && i.id == inv_id)
    {
        inv.status = "REVOKED".to_string();
    }

    Ok(Json(SuccessResponse {
        success: true,
        message: "Invitation revoked".to_string(),
    }))
}

/// POST /api/v1/invitations/:token/accept — Accepts invitation
pub async fn accept_invitation(
    State(state): State<AppState>,
    Path(token): Path<String>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, ApiError> {
    let auth = extract_auth_context(&headers)
        .ok_or_else(|| ApiError::unauthorized("Valid authentication token required"))?;

    if let Some(ref db) = state.database {
        let member = db
            .accept_team_invitation(
                &token,
                auth.user_id,
                auth.email.as_deref(),
                auth.full_name.as_deref(),
            )
            .await
            .map_err(|e| ApiError::bad_request(format!("Cannot accept invitation: {}", e)))?;

        return Ok(Json(member));
    }

    if state.require_database {
        return Err(ApiError::service_unavailable(
            "PostgreSQL persistence is required. In-memory fallback is disabled in beta/production.",
        ));
    }

    let mut invs = state.team_invitations.write().await;
    let inv = invs
        .iter_mut()
        .find(|i| i.token == token && i.status == "PENDING" && i.expires_at > chrono::Utc::now())
        .ok_or_else(|| ApiError::bad_request("Invalid, expired, or already accepted invitation"))?;

    inv.status = "ACCEPTED".to_string();
    inv.updated_at = chrono::Utc::now();
    let team_id = inv.team_id;
    let role = inv.role.clone();

    let now = chrono::Utc::now();
    let member = TeamMember {
        id: Uuid::new_v4(),
        team_id,
        user_id: auth.user_id,
        email: auth.email.clone(),
        full_name: auth.full_name.clone(),
        role,
        is_active: true,
        created_at: now,
        updated_at: now,
    };

    state.team_members.write().await.push(member.clone());
    Ok(Json(member))
}
