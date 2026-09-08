// =============================================================================
// Auth Module — Current Authenticated User & Membership Metadata
// =============================================================================

use axum::{
    extract::State,
    http::HeaderMap,
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use sha2::Digest;
use uuid::Uuid;

use crate::api::middleware::verify_jwt;
use crate::api::state::AppState;
use crate::domain::models::UserProjectMembership;

#[derive(Debug, Serialize)]
pub struct AuthMeResponse {
    pub user_id: Uuid,
    pub sub: String,
    pub email: Option<String>,
    pub full_name: Option<String>,
    pub global_role: String,
    pub projects: Vec<UserProjectMembership>,
}

#[derive(Debug, Serialize)]
pub struct AuthErrorResponse {
    pub error: String,
    pub code: String,
}

/// GET /api/v1/auth/me
/// Returns authenticated user profile and authoritative active project memberships
pub async fn get_me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let auth_header = match headers.get("authorization").and_then(|v| v.to_str().ok()) {
        Some(h) => h,
        None => {
            return (
                axum::http::StatusCode::UNAUTHORIZED,
                Json(AuthErrorResponse {
                    error: "Missing Authorization header".to_string(),
                    code: "UNAUTHORIZED".to_string(),
                }),
            )
                .into_response();
        }
    };

    let token = auth_header
        .strip_prefix("Bearer ")
        .or_else(|| auth_header.strip_prefix("bearer "))
        .unwrap_or(auth_header)
        .trim();

    let claims = match verify_jwt(token) {
        Some(c) => c,
        None => {
            return (
                axum::http::StatusCode::UNAUTHORIZED,
                Json(AuthErrorResponse {
                    error: "Invalid, expired, or untrusted JWT token".to_string(),
                    code: "INVALID_TOKEN".to_string(),
                }),
            )
                .into_response();
        }
    };

    let user_id = Uuid::parse_str(&claims.sub).unwrap_or_else(|_| {
        let hash = sha2::Sha256::digest(claims.sub.as_bytes());
        Uuid::from_slice(&hash[0..16]).unwrap_or_default()
    });

    let role_str = claims
        .user_metadata
        .as_ref()
        .and_then(|m| m.role.as_deref())
        .or(claims.role.as_deref())
        .unwrap_or("PLANNER");

    let full_name = claims
        .user_metadata
        .as_ref()
        .and_then(|m| m.full_name.clone());

    // Fetch projects from database if available
    let projects = if let Some(db) = &state.database {
        db.list_user_project_memberships(user_id)
            .await
            .unwrap_or_default()
    } else {
        // In-memory fallback
        let projects_lock = state.projects.read().await;
        projects_lock
            .iter()
            .map(|p| UserProjectMembership {
                project_id: p.id,
                project_code: p.code.clone(),
                project_name: p.name.clone(),
                role: role_str.to_string(),
            })
            .collect()
    };

    Json(AuthMeResponse {
        user_id,
        sub: claims.sub,
        email: None,
        full_name,
        global_role: role_str.to_string(),
        projects,
    })
    .into_response()
}
