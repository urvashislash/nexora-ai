use axum::{
    body::Body,
    extract::Request,
    http::{header::HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use uuid::Uuid;

use crate::domain::models::UserRole;

/// Permissions guarding specific operations
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)]
pub enum Permission {
    ViewProject,
    CreateObservation,
    ReviewProposal,
    ApproveProposal,
    OverrideProposal,
    ViewAudit,
    ExportSchedule,
    Admin,
}

/// Authenticated caller extracted from request headers
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub user_id: Uuid,
    pub role: UserRole,
}

/// Returns the permissions granted to a given role
#[allow(dead_code)]
pub fn role_permissions(role: &UserRole) -> Vec<Permission> {
    match role {
        UserRole::Admin => vec![
            Permission::ViewProject,
            Permission::CreateObservation,
            Permission::ReviewProposal,
            Permission::ApproveProposal,
            Permission::OverrideProposal,
            Permission::ViewAudit,
            Permission::ExportSchedule,
            Permission::Admin,
        ],
        UserRole::Planner => vec![
            Permission::ViewProject,
            Permission::CreateObservation,
            Permission::ReviewProposal,
            Permission::ApproveProposal,
            Permission::OverrideProposal,
            Permission::ViewAudit,
            Permission::ExportSchedule,
        ],
        UserRole::Engineer | UserRole::Supervisor => vec![
            Permission::ViewProject,
            Permission::CreateObservation,
        ],
        UserRole::Auditor => vec![
            Permission::ViewProject,
            Permission::ViewAudit,
        ],
        UserRole::Viewer => vec![
            Permission::ViewProject,
        ],
    }
}

/// Extracts authentication context from request headers.
/// Returns `None` if headers are missing or invalid.
pub fn extract_auth_context(headers: &HeaderMap) -> Option<AuthContext> {
    let user_id_str = headers
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())?;
    let user_id = Uuid::parse_str(user_id_str).ok()?;

    let role_str = headers
        .get("x-user-role")
        .and_then(|v| v.to_str().ok())?;

    let role = match role_str.to_uppercase().as_str() {
        "ADMIN" => UserRole::Admin,
        "PLANNER" => UserRole::Planner,
        "ENGINEER" => UserRole::Engineer,
        "SUPERVISOR" => UserRole::Supervisor,
        "AUDITOR" => UserRole::Auditor,
        "VIEWER" => UserRole::Viewer,
        _ => return None,
    };

    Some(AuthContext { user_id, role })
}

#[derive(Serialize)]
struct RbacError {
    error: String,
    code: String,
}

/// Middleware that enforces a minimum required permission.
///
/// Usage (in route layer):
/// ```ignore
/// .layer(axum::middleware::from_fn(|req, next| require_permission(req, next, Permission::ApproveProposal)))
/// ```
pub async fn require_permission(
    request: Request<Body>,
    next: Next,
    required: Permission,
) -> Response {
    let headers = request.headers().clone();

    match extract_auth_context(&headers) {
        None => {
            let body = RbacError {
                error: "Missing or invalid authentication headers (X-User-Id, X-User-Role)".to_string(),
                code: "AUTH_REQUIRED".to_string(),
            };
            (StatusCode::UNAUTHORIZED, Json(body)).into_response()
        }
        Some(auth) => {
            let perms = role_permissions(&auth.role);
            if !perms.contains(&required) {
                let body = RbacError {
                    error: format!(
                        "Role {:?} does not have {:?} permission",
                        auth.role, required
                    ),
                    code: "FORBIDDEN".to_string(),
                };
                return (StatusCode::FORBIDDEN, Json(body)).into_response();
            }
            // Auth passed — proceed to the handler
            next.run(request).await
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_admin_has_all_permissions() {
        let perms = role_permissions(&UserRole::Admin);
        assert!(perms.contains(&Permission::Admin));
        assert!(perms.contains(&Permission::ApproveProposal));
        assert!(perms.contains(&Permission::ViewProject));
    }

    #[test]
    fn test_viewer_has_only_view() {
        let perms = role_permissions(&UserRole::Viewer);
        assert!(perms.contains(&Permission::ViewProject));
        assert!(!perms.contains(&Permission::ApproveProposal));
        assert!(!perms.contains(&Permission::Admin));
    }

    #[test]
    fn test_planner_cannot_admin() {
        let perms = role_permissions(&UserRole::Planner);
        assert!(!perms.contains(&Permission::Admin));
        assert!(perms.contains(&Permission::ApproveProposal));
        assert!(perms.contains(&Permission::OverrideProposal));
    }

    #[test]
    fn test_auditor_can_view_audit() {
        let perms = role_permissions(&UserRole::Auditor);
        assert!(perms.contains(&Permission::ViewAudit));
        assert!(!perms.contains(&Permission::ApproveProposal));
    }

    #[test]
    fn test_engineer_can_create_observation() {
        let perms = role_permissions(&UserRole::Engineer);
        assert!(perms.contains(&Permission::CreateObservation));
        assert!(!perms.contains(&Permission::ApproveProposal));
    }

    #[test]
    fn test_extract_auth_context_valid() {
        let mut headers = HeaderMap::new();
        headers.insert("x-user-id", "a0000000-0000-0000-0000-000000000001".parse().unwrap());
        headers.insert("x-user-role", "PLANNER".parse().unwrap());
        let ctx = extract_auth_context(&headers).unwrap();
        assert_eq!(ctx.role, UserRole::Planner);
    }

    #[test]
    fn test_extract_auth_context_missing_headers() {
        let headers = HeaderMap::new();
        assert!(extract_auth_context(&headers).is_none());
    }

    #[test]
    fn test_extract_auth_context_invalid_role() {
        let mut headers = HeaderMap::new();
        headers.insert("x-user-id", "a0000000-0000-0000-0000-000000000001".parse().unwrap());
        headers.insert("x-user-role", "UNKNOWN_ROLE".parse().unwrap());
        assert!(extract_auth_context(&headers).is_none());
    }
}
