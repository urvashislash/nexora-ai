use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tokio::sync::Mutex;
use tower::ServiceExt;

use backend::api::handlers::AppState;
use backend::api::middleware::get_jwt_secret;
use backend::api::routes::create_router;

static TEST_ENV_LOCK: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn test_liveness_probe_returns_200() {
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let res = app
        .oneshot(
            Request::builder()
                .uri("/liveness")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(json["status"], "alive");
    assert_eq!(json["service"], "nexora-trust-plane");
}

#[tokio::test]
async fn test_readiness_probe_returns_503_when_unready() {
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let res = app
        .oneshot(
            Request::builder()
                .uri("/readiness")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::SERVICE_UNAVAILABLE);
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(json["status"], "not_ready");
    assert_eq!(json["dependencies"]["database"], "not_configured");
}

#[test]
fn test_production_fails_fast_on_insecure_jwt_secret() {
    let _guard = TEST_ENV_LOCK.blocking_lock();

    std::env::set_var("APP_ENV", "production");
    std::env::set_var("JWT_SECRET", "dev-secret-key-nexora-trust-plane-2026");

    let result = std::panic::catch_unwind(|| {
        get_jwt_secret();
    });

    // Cleanup env
    std::env::remove_var("APP_ENV");
    std::env::remove_var("JWT_SECRET");

    assert!(
        result.is_err(),
        "Must panic when dev-secret-key is used in production"
    );
}

#[test]
fn test_production_fails_fast_on_missing_jwt_secret() {
    let _guard = TEST_ENV_LOCK.blocking_lock();

    std::env::set_var("APP_ENV", "production");
    std::env::remove_var("SUPABASE_JWT_SECRET");
    std::env::remove_var("JWT_SECRET");

    let result = std::panic::catch_unwind(|| {
        get_jwt_secret();
    });

    // Cleanup env
    std::env::remove_var("APP_ENV");

    assert!(
        result.is_err(),
        "Must panic when JWT secret is missing in production"
    );
}
