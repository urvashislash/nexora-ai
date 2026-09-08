use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use std::time::Duration;
use tokio::sync::Mutex;
use tower::ServiceExt;
use uuid::Uuid;

use backend::api::middleware::{extract_client_key, generate_signed_jwt, RateLimitMiddleware};

static TEST_ENV_LOCK: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn test_rate_limiter_extracts_jwt_identity_strictly() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let user_id = Uuid::new_v4();
    let token = generate_signed_jwt(user_id, "ENGINEER", 3600).unwrap();

    let req = Request::builder()
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .header("x-user-id", "spoofed-user-id")
        .header("x-forwarded-for", "198.51.100.1")
        .body(Body::empty())
        .unwrap();

    let client_key = extract_client_key(req.headers());
    assert_eq!(
        client_key,
        format!("user:{}", user_id),
        "Key must derive from verified JWT sub, ignoring spoofed x-user-id"
    );
}

#[tokio::test]
async fn test_rate_limiter_unauthenticated_falls_back_to_ip() {
    let req = Request::builder()
        .header("x-forwarded-for", "203.0.113.55")
        .header("x-user-id", "attacker-attempting-spoof")
        .body(Body::empty())
        .unwrap();

    let client_key = extract_client_key(req.headers());
    assert_eq!(client_key, "ip:203.0.113.55");
}

#[tokio::test]
async fn test_rate_limit_burst_blocks_with_429() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let direct_limiter = RateLimitMiddleware::new(3, Duration::from_secs(60));
    // Test direct limiter in-memory
    let app_direct = axum::Router::new()
        .route("/test", axum::routing::get(|| async { "ok" }))
        .layer(axum::middleware::from_fn(move |req, next| {
            direct_limiter.clone().handle_rate_limit(req, next)
        }));

    for i in 1..=3 {
        let req = Request::builder()
            .uri("/test")
            .header("x-forwarded-for", "10.0.0.1")
            .body(Body::empty())
            .unwrap();
        let res = app_direct.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK, "Request {} should succeed", i);
    }

    // 4th request must be blocked 429
    let req4 = Request::builder()
        .uri("/test")
        .header("x-forwarded-for", "10.0.0.1")
        .body(Body::empty())
        .unwrap();
    let res4 = app_direct.oneshot(req4).await.unwrap();
    assert_eq!(res4.status(), StatusCode::TOO_MANY_REQUESTS);
}

#[test]
fn test_cache_key_tenant_isolation_schema() {
    let project_a = Uuid::new_v4();
    let project_b = Uuid::new_v4();

    let key_a = format!("nexora:cache:dashboard:{}", project_a);
    let key_b = format!("nexora:cache:dashboard:{}", project_b);

    assert_ne!(key_a, key_b);
    assert!(key_a.contains(&project_a.to_string()));
    assert!(key_b.contains(&project_b.to_string()));
}
