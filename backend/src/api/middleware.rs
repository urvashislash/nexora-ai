use axum::{
    body::Body,
    extract::Request,
    http::{header::HeaderMap, HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
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
    ManageRetention,
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
            Permission::ManageRetention,
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
        UserRole::Engineer | UserRole::Supervisor => {
            vec![Permission::ViewProject, Permission::CreateObservation]
        }
        UserRole::Auditor => vec![Permission::ViewProject, Permission::ViewAudit],
        UserRole::Viewer => vec![Permission::ViewProject],
    }
}

/// Extracts authentication context from request headers.
/// Returns `None` if headers are missing or invalid.
pub fn extract_auth_context(headers: &HeaderMap) -> Option<AuthContext> {
    let user_id_str = headers.get("x-user-id").and_then(|v| v.to_str().ok())?;
    let user_id = Uuid::parse_str(user_id_str).ok()?;

    let role_str = headers.get("x-user-role").and_then(|v| v.to_str().ok())?;

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
struct SecurityErrorResponse {
    error: String,
    code: String,
}

/// Middleware that enforces a minimum required permission.
pub async fn require_permission(
    request: Request<Body>,
    next: Next,
    required: Permission,
) -> Response {
    let headers = request.headers().clone();

    match extract_auth_context(&headers) {
        None => {
            let body = SecurityErrorResponse {
                error: "Missing or invalid authentication headers (X-User-Id, X-User-Role)"
                    .to_string(),
                code: "AUTH_REQUIRED".to_string(),
            };
            (StatusCode::UNAUTHORIZED, Json(body)).into_response()
        }
        Some(auth) => {
            let perms = role_permissions(&auth.role);
            if !perms.contains(&required) {
                let body = SecurityErrorResponse {
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

// =============================================================================
// Security Headers Middleware
// =============================================================================

/// Middleware that injects defense-in-depth HTTP security headers into all responses
pub async fn security_headers_middleware(request: Request<Body>, next: Next) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));
    headers.insert("x-xss-protection", HeaderValue::from_static("0"));
    headers.insert(
        "referrer-policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        "strict-transport-security",
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    headers.insert(
        "content-security-policy",
        HeaderValue::from_static("default-src 'self'; frame-ancestors 'none';"),
    );

    response
}

// =============================================================================
// Rate Limiter
// =============================================================================

#[derive(Clone)]
pub struct InMemoryRateLimiter {
    window_duration: Duration,
    max_requests: usize,
    state: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
}

impl InMemoryRateLimiter {
    pub fn new(max_requests: usize, window_duration: Duration) -> Self {
        Self {
            window_duration,
            max_requests,
            state: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Checks if a request from the given key is allowed.
    /// Returns Ok(remaining_requests) if allowed, or Err(retry_after_seconds) if limited.
    pub async fn check(&self, key: &str) -> Result<usize, u64> {
        let now = Instant::now();
        let mut map = self.state.lock().await;

        let timestamps = map.entry(key.to_string()).or_default();

        // Evict expired timestamps
        timestamps.retain(|&ts| now.duration_since(ts) < self.window_duration);

        if timestamps.len() >= self.max_requests {
            let earliest = timestamps.first().cloned().unwrap_or(now);
            let elapsed = now.duration_since(earliest);
            let retry_after = if elapsed < self.window_duration {
                (self.window_duration - elapsed).as_secs().max(1)
            } else {
                1
            };
            Err(retry_after)
        } else {
            timestamps.push(now);
            Ok(self.max_requests - timestamps.len())
        }
    }
}

/// Helper function to extract a rate-limiting key (IP or user) from headers
pub fn extract_client_key(headers: &HeaderMap) -> String {
    if let Some(user_id) = headers.get("x-user-id").and_then(|v| v.to_str().ok()) {
        return format!("user:{}", user_id);
    }
    if let Some(forwarded) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        if let Some(first_ip) = forwarded.split(',').next() {
            return format!("ip:{}", first_ip.trim());
        }
    }
    "ip:anonymous".to_string()
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_admin_has_all_permissions() {
        let perms = role_permissions(&UserRole::Admin);
        assert!(perms.contains(&Permission::Admin));
        assert!(perms.contains(&Permission::ApproveProposal));
        assert!(perms.contains(&Permission::ManageRetention));
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
    fn test_planner_permissions() {
        let perms = role_permissions(&UserRole::Planner);
        assert!(!perms.contains(&Permission::Admin));
        assert!(perms.contains(&Permission::ApproveProposal));
        assert!(perms.contains(&Permission::OverrideProposal));
        assert!(!perms.contains(&Permission::ManageRetention));
    }

    #[test]
    fn test_auditor_permissions() {
        let perms = role_permissions(&UserRole::Auditor);
        assert!(perms.contains(&Permission::ViewAudit));
        assert!(!perms.contains(&Permission::ApproveProposal));
        assert!(!perms.contains(&Permission::ManageRetention));
    }

    #[test]
    fn test_extract_auth_context_valid() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-user-id",
            "a0000000-0000-0000-0000-000000000001".parse().unwrap(),
        );
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
        headers.insert(
            "x-user-id",
            "a0000000-0000-0000-0000-000000000001".parse().unwrap(),
        );
        headers.insert("x-user-role", "INVALID_ROLE".parse().unwrap());
        assert!(extract_auth_context(&headers).is_none());
    }

    #[tokio::test]
    async fn test_rate_limiter_allows_under_threshold() {
        let limiter = InMemoryRateLimiter::new(3, Duration::from_secs(60));
        let key = "client_1";

        assert!(limiter.check(key).await.is_ok());
        assert!(limiter.check(key).await.is_ok());
        assert!(limiter.check(key).await.is_ok());
    }

    #[tokio::test]
    async fn test_rate_limiter_blocks_over_threshold() {
        let limiter = InMemoryRateLimiter::new(2, Duration::from_secs(60));
        let key = "client_2";

        assert_eq!(limiter.check(key).await, Ok(1));
        assert_eq!(limiter.check(key).await, Ok(0));
        assert!(limiter.check(key).await.is_err());
    }

    #[test]
    fn test_extract_client_key_with_user_id() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-user-id",
            "123e4567-e89b-12d3-a456-426614174000".parse().unwrap(),
        );
        assert_eq!(
            extract_client_key(&headers),
            "user:123e4567-e89b-12d3-a456-426614174000"
        );
    }

    #[test]
    fn test_extract_client_key_with_forwarded_for() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            "203.0.113.195, 70.41.3.18".parse().unwrap(),
        );
        assert_eq!(extract_client_key(&headers), "ip:203.0.113.195");
    }
}

// =============================================================================
// Rate Limiting Middleware
// =============================================================================

#[derive(Clone)]
pub struct RateLimitMiddleware {
    limiter: Arc<InMemoryRateLimiter>,
}

impl RateLimitMiddleware {
    pub fn new(max_requests: usize, window_duration: Duration) -> Self {
        Self {
            limiter: Arc::new(InMemoryRateLimiter::new(max_requests, window_duration)),
        }
    }

    #[allow(clippy::result_large_err)]
    pub async fn handle_rate_limit(
        self,
        request: Request<Body>,
        next: Next,
    ) -> Result<Response, Response> {
        let client_key = extract_client_key(request.headers());

        match self.limiter.check(&client_key).await {
            Ok(_remaining) => {
                // Add rate limit headers
                let response = next.run(request).await;
                Ok(response)
            }
            Err(retry_after) => {
                let error_response = Json(RateLimitError {
                    error: "Too many requests".to_string(),
                    code: "RATE_LIMIT_EXCEEDED".to_string(),
                    retry_after_seconds: retry_after,
                });
                Err((StatusCode::TOO_MANY_REQUESTS, error_response).into_response())
            }
        }
    }
}

#[derive(Serialize)]
struct RateLimitError {
    error: String,
    code: String,
    retry_after_seconds: u64,
}
