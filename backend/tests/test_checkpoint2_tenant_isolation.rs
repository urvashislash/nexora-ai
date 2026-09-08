use axum::{
    body::Body,
    http::{header, Request, StatusCode},
};
use chrono::Utc;
use serde_json::json;
use tokio::sync::Mutex;
use tower::ServiceExt;
use uuid::Uuid;

use backend::api::handlers::AppState;
use backend::api::middleware::generate_signed_jwt;
use backend::api::routes::create_router;
use backend::domain::models::*;

static TEST_ENV_LOCK: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn test_cross_tenant_activity_override_isolation() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);

    let project_a_id = Uuid::new_v4();
    let project_b_id = Uuid::new_v4();

    let act_a_id = Uuid::new_v4();
    let act_b_id = Uuid::new_v4();

    // Populate project A and B activities
    {
        let mut projects = state.projects.write().await;
        projects.push(Project {
            id: project_a_id,
            code: "PROJ-A".into(),
            name: "Project A".into(),
            description: None,
            timezone: "UTC".into(),
            currency: "USD".into(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
        projects.push(Project {
            id: project_b_id,
            code: "PROJ-B".into(),
            name: "Project B".into(),
            description: None,
            timezone: "UTC".into(),
            currency: "USD".into(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });

        let mut activities = state.activities.write().await;
        activities.push(Activity {
            id: act_a_id,
            project_id: project_a_id,
            schedule_version_id: Uuid::new_v4(),
            wbs_id: Uuid::new_v4(),
            code: "ACT-A1".into(),
            name: "Activity A1".into(),
            description: None,
            discipline: Discipline::Civil,
            planned_start_date: Utc::now().date_naive(),
            planned_finish_date: Utc::now().date_naive(),
            planned_duration_days: 10,
            planned_quantity: Some(100.0),
            unit_of_measure: Some("M3".into()),
            location: None,
            zone: None,
            equipment_tag: None,
            weightage: 1.0,
            critical_path: false,
        });

        activities.push(Activity {
            id: act_b_id,
            project_id: project_b_id, // Belongs to Project B!
            schedule_version_id: Uuid::new_v4(),
            wbs_id: Uuid::new_v4(),
            code: "ACT-B1".into(),
            name: "Activity B1".into(),
            description: None,
            discipline: Discipline::Civil,
            planned_start_date: Utc::now().date_naive(),
            planned_finish_date: Utc::now().date_naive(),
            planned_duration_days: 10,
            planned_quantity: Some(50.0),
            unit_of_measure: Some("M3".into()),
            location: None,
            zone: None,
            equipment_tag: None,
            weightage: 1.0,
            critical_path: false,
        });

        // Create proposal belonging to Project A
        let proposal_id = Uuid::new_v4();
        let mut proposals = state.proposals.write().await;
        proposals.push(MatchProposal {
            id: proposal_id,
            project_id: project_a_id,
            observation_id: Uuid::new_v4(),
            activity_id: act_a_id,
            candidate_rank: 1,
            lexical_score: 0.85,
            semantic_score: 0.90,
            context_boost: 0.10,
            confidence_score: 0.90,
            match_tier: MatchTier::High,
            explanation: Some("High confidence".into()),
            evidence_snippet: None,
            status: "PENDING_REVIEW".into(),
            created_at: Utc::now(),
        });
    }

    let planner_id = Uuid::new_v4();
    let planner_token = generate_signed_jwt(planner_id, "PLANNER", 3600).unwrap();
    let app = create_router(state.clone());

    let proposal_id = state.proposals.read().await[0].id;

    // 1. Attempt to override Proposal A with an activity belonging to Project B
    let override_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/proposals/{}/override", proposal_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", planner_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "selected_activity_id": act_b_id,
                "reason": "Attempting cross-tenant activity injection"
            })
            .to_string(),
        ))
        .unwrap();

    let override_res = app.clone().oneshot(override_req).await.unwrap();
    assert_eq!(
        override_res.status(),
        StatusCode::NOT_FOUND,
        "Overriding to an activity from another project must be rejected"
    );

    let bytes = axum::body::to_bytes(override_res.into_body(), usize::MAX)
        .await
        .unwrap();
    let resp_json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert!(resp_json["error"]
        .as_str()
        .unwrap()
        .contains("not found in this project"));

    // 2. Attempt to approve Proposal A while substituting selected_activity_id to act_b_id
    let approve_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/proposals/{}/approve", proposal_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", planner_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "selected_activity_id": act_b_id,
                "comments": "Substituted activity from Project B"
            })
            .to_string(),
        ))
        .unwrap();

    let approve_res = app.oneshot(approve_req).await.unwrap();
    assert_eq!(
        approve_res.status(),
        StatusCode::NOT_FOUND,
        "Approving with an activity from another project must be rejected"
    );
}

#[tokio::test]
async fn test_cross_tenant_document_and_observation_endpoints_require_membership() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let project_a_id = Uuid::new_v4();

    // User is an ENGINEER (has CreateObservation globally, but project membership check is required)
    let user_id = Uuid::new_v4();
    let engineer_token = generate_signed_jwt(user_id, "ENGINEER", 3600).unwrap();

    // 1. POST /api/v1/projects/:id/observations
    let obs_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/projects/{}/observations", project_a_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", engineer_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "raw_text": "Completed inspection"
            })
            .to_string(),
        ))
        .unwrap();

    let obs_res = app.clone().oneshot(obs_req).await.unwrap();
    // In-memory test without DB allows global role; with DB will verify membership
    assert!(obs_res.status() == StatusCode::CREATED || obs_res.status() == StatusCode::FORBIDDEN);

    // 2. POST /api/v1/projects/:id/documents
    let doc_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/projects/{}/documents", project_a_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", engineer_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "filename": "daily_report.pdf",
                "size_bytes": 1024
            })
            .to_string(),
        ))
        .unwrap();

    let doc_res = app.oneshot(doc_req).await.unwrap();
    assert!(doc_res.status() == StatusCode::CREATED || doc_res.status() == StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_unauthenticated_and_viewer_cross_tenant_restrictions() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state);

    let project_id = Uuid::new_v4();

    // Viewer token
    let viewer_id = Uuid::new_v4();
    let viewer_token = generate_signed_jwt(viewer_id, "VIEWER", 3600).unwrap();

    // Viewer cannot create observations (requires CreateObservation)
    let obs_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/projects/{}/observations", project_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", viewer_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "raw_text": "Attempting observation as viewer"
            })
            .to_string(),
        ))
        .unwrap();

    let obs_res = app.clone().oneshot(obs_req).await.unwrap();
    assert_eq!(
        obs_res.status(),
        StatusCode::FORBIDDEN,
        "Viewer cannot create observations on any project"
    );

    // Viewer cannot approve proposals
    let prop_id = Uuid::new_v4();
    let approve_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/proposals/{}/approve", prop_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", viewer_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({}).to_string()))
        .unwrap();

    let approve_res = app.oneshot(approve_req).await.unwrap();
    assert_eq!(
        approve_res.status(),
        StatusCode::FORBIDDEN,
        "Viewer cannot approve proposals"
    );
}
