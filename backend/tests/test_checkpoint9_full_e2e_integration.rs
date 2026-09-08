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
use backend::domain::ledger::EventLedger;
use backend::domain::models::*;

static TEST_ENV_LOCK: Mutex<()> = Mutex::const_new(());

#[tokio::test]
async fn test_full_lifecycle_end_to_end_integration() {
    let _guard = TEST_ENV_LOCK.lock().await;
    let state = AppState::empty(None, None, None);
    let app = create_router(state.clone());

    // 1. Authenticated User (Admin) creates a project
    let admin_id = Uuid::new_v4();
    let admin_token = generate_signed_jwt(admin_id, "ADMIN", 3600).unwrap();

    let create_proj_req = Request::builder()
        .method("POST")
        .uri("/api/v1/projects")
        .header(header::AUTHORIZATION, format!("Bearer {}", admin_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "code": "METRO-E2E",
                "name": "Metro Extension Line 4",
                "timezone": "Asia/Kolkata",
                "currency": "INR",
            })
            .to_string(),
        ))
        .unwrap();

    let create_proj_res = app.clone().oneshot(create_proj_req).await.unwrap();
    assert_eq!(create_proj_res.status(), StatusCode::OK);
    let proj_bytes = axum::body::to_bytes(create_proj_res.into_body(), usize::MAX)
        .await
        .unwrap();
    let proj_json: serde_json::Value = serde_json::from_slice(&proj_bytes).unwrap();
    let project_id = Uuid::parse_str(proj_json["id"].as_str().unwrap()).unwrap();

    // 2. Member Assignment & Schedule Commit
    let activity_id = Uuid::new_v4();
    {
        let mut activities = state.activities.write().await;
        activities.push(Activity {
            id: activity_id,
            project_id,
            schedule_version_id: Uuid::new_v4(),
            wbs_id: Uuid::new_v4(),
            code: "ACT-CIVIL-01".into(),
            name: "Pier Foundation Concreting".into(),
            description: None,
            discipline: Discipline::Civil,
            planned_start_date: Utc::now().date_naive(),
            planned_finish_date: Utc::now().date_naive(),
            planned_duration_days: 14,
            planned_quantity: Some(250.0),
            unit_of_measure: Some("M3".into()),
            location: Some("Chainage 12+400".into()),
            zone: Some("Zone 1".into()),
            equipment_tag: None,
            weightage: 1.0,
            critical_path: true,
        });

        let mut act_states = state.activity_states.write().await;
        act_states.push(ActivityCurrentState {
            activity_id,
            project_id,
            execution_status: ExecutionStatus::NotStarted,
            current_progress_pct: 0.0,
            actual_start_date: None,
            actual_finish_date: None,
            cumulative_quantity: 0.0,
            is_critical_path_delayed: false,
            variance_days: 0,
            last_event_id: None,
            last_event_date: None,
            updated_at: Utc::now(),
        });
    }

    // 3. Observation Ingestion by Site Supervisor
    let supervisor_id = Uuid::new_v4();
    let supervisor_token = generate_signed_jwt(supervisor_id, "SUPERVISOR", 3600).unwrap();

    let obs_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/projects/{}/observations", project_id))
        .header(
            header::AUTHORIZATION,
            format!("Bearer {}", supervisor_token),
        )
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "raw_text": "Completed pier foundation concreting zone 1 pier 42",
                "discipline": "CIVIL",
                "location": "Chainage 12+400",
                "reported_progress": 100.0,
            })
            .to_string(),
        ))
        .unwrap();

    let obs_res = app.clone().oneshot(obs_req).await.unwrap();
    assert_eq!(obs_res.status(), StatusCode::CREATED);

    // 4. Match Proposal Generated
    let proposal_id = Uuid::new_v4();
    {
        let mut proposals = state.proposals.write().await;
        proposals.push(MatchProposal {
            id: proposal_id,
            project_id,
            observation_id: Uuid::new_v4(),
            activity_id,
            candidate_rank: 1,
            lexical_score: 0.92,
            semantic_score: 0.95,
            context_boost: 0.1,
            confidence_score: 0.96,
            match_tier: MatchTier::High,
            explanation: Some("Exact match with Pier Foundation Concreting".into()),
            evidence_snippet: Some("Completed pier foundation concreting zone 1".into()),
            status: "PENDING_REVIEW".into(),
            created_at: Utc::now(),
        });
    }

    // 5. Review Queue Inspection by Planner
    let planner_id = Uuid::new_v4();
    let planner_token = generate_signed_jwt(planner_id, "PLANNER", 3600).unwrap();

    let queue_req = Request::builder()
        .method("GET")
        .uri(format!("/api/v1/projects/{}/review-queue", project_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", planner_token))
        .body(Body::empty())
        .unwrap();

    let queue_res = app.clone().oneshot(queue_req).await.unwrap();
    assert_eq!(queue_res.status(), StatusCode::OK);

    // 6. Planner Approves Proposal
    let approve_req = Request::builder()
        .method("POST")
        .uri(format!("/api/v1/proposals/{}/approve", proposal_id))
        .header(header::AUTHORIZATION, format!("Bearer {}", planner_token))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "comments": "Approved after field inspection verification"
            })
            .to_string(),
        ))
        .unwrap();

    let approve_res = app.clone().oneshot(approve_req).await.unwrap();
    assert_eq!(approve_res.status(), StatusCode::OK);

    // 7. Verification: Actual Event Recorded & Progress Projected to 100%
    let events = state.events.read().await;
    assert_eq!(events.len(), 1, "Exactly one actual event must be created");
    assert_eq!(events[0].activity_id, activity_id);
    assert_eq!(events[0].lifecycle_status, LifecycleStatus::Committed);

    let states = state.activity_states.read().await;
    let act_state = states
        .iter()
        .find(|s| s.activity_id == activity_id)
        .expect("Activity state must exist");
    assert_eq!(act_state.current_progress_pct, 100.0);
    assert_eq!(act_state.execution_status, ExecutionStatus::Completed);

    // 8. Immutable Audit Trail & Hash Chain Verification
    let audit_req = Request::builder()
        .method("GET")
        .uri(format!(
            "/api/v1/projects/{}/audit-trail/verify",
            project_id
        ))
        .header(header::AUTHORIZATION, format!("Bearer {}", planner_token))
        .body(Body::empty())
        .unwrap();

    let audit_res = app.clone().oneshot(audit_req).await.unwrap();
    assert_eq!(audit_res.status(), StatusCode::OK);
    let audit_bytes = axum::body::to_bytes(audit_res.into_body(), usize::MAX)
        .await
        .unwrap();
    let audit_json: serde_json::Value = serde_json::from_slice(&audit_bytes).unwrap();
    assert_eq!(audit_json["valid"], true, "Audit chain must be valid");

    // 9. Transactional Outbox Event Verified
    let outbox = state.outbox_events.read().await;
    let pending_outbox = EventLedger::get_pending_outbox_events(&outbox);
    assert!(
        !pending_outbox.is_empty(),
        "At least one outbox event must be queued for delivery"
    );
    assert_eq!(pending_outbox[0].status, "PENDING");
}
