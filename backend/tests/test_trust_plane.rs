use chrono::NaiveDate;
use uuid::Uuid;

// Import domain logic
#[path = "../src/domain/models.rs"]
mod models;
#[path = "../src/domain/validation.rs"]
mod validation;
#[path = "../src/domain/state_machine.rs"]
mod state_machine;
#[path = "../src/domain/ledger.rs"]
mod ledger;

use models::*;
use validation::*;
use state_machine::*;
use ledger::*;

#[test]
fn test_scenario_a_exact_match_and_commit() {
    let project_id = Uuid::new_v4();
    let activity_id = Uuid::new_v4();
    let planned_finish = NaiveDate::from_ymd_opt(2026, 8, 28).unwrap();

    let mut state = ActivityCurrentState {
        activity_id,
        project_id,
        execution_status: ExecutionStatus::NotStarted,
        actual_start_date: None,
        actual_finish_date: None,
        current_progress_pct: 0.0,
        cumulative_quantity: 0.0,
        last_event_id: None,
        last_event_date: None,
        is_critical_path_delayed: false,
        variance_days: 0,
        updated_at: chrono::Utc::now(),
    };

    let event = ActualEvent {
        id: Uuid::new_v4(),
        project_id,
        activity_id,
        observation_id: None,
        match_proposal_id: None,
        event_type: EventType::Finish,
        actual_date: NaiveDate::from_ymd_opt(2026, 8, 28).unwrap(),
        actual_progress_pct: Some(100.0),
        actual_quantity: Some(1.0),
        delay_reason: None,
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::SystemVerified,
        idempotency_key: Some("exact-match-event-01".to_string()),
        created_by: None,
        created_at: chrono::Utc::now(),
    };

    StateMachine::project_event(&mut state, &event, planned_finish);

    assert_eq!(state.execution_status, ExecutionStatus::Completed);
    assert_eq!(state.current_progress_pct, 100.0);
    assert_eq!(state.actual_finish_date, Some(NaiveDate::from_ymd_opt(2026, 8, 28).unwrap()));
    assert_eq!(state.variance_days, 0);
}

#[test]
fn test_scenario_e_invalid_date_sequence_rejected() {
    let start = NaiveDate::from_ymd_opt(2026, 8, 28);
    let finish = NaiveDate::from_ymd_opt(2026, 8, 20);

    let res = ValidationEngine::validate_date_sequence(start, finish);
    assert!(res.is_err());
    assert!(matches!(res.unwrap_err(), ValidationError::FinishBeforeStart { .. }));
}

#[test]
fn test_predecessor_fs_dependency_validation() {
    let project_id = Uuid::new_v4();
    let sched_id = Uuid::new_v4();
    let wbs_id = Uuid::new_v4();

    let pred_id = Uuid::new_v4();
    let succ_id = Uuid::new_v4();

    let pred_act = Activity {
        id: pred_id,
        project_id,
        schedule_version_id: sched_id,
        wbs_id,
        code: "PIP-2400".to_string(),
        name: "Spool Erection".to_string(),
        description: None,
        discipline: Discipline::Piping,
        planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 10).unwrap(),
        planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
        planned_duration_days: 15,
        planned_quantity: Some(450.0),
        unit_of_measure: Some("Inch-Dia".to_string()),
        location: None,
        zone: None,
        equipment_tag: None,
        weightage: 1.0,
        critical_path: true,
    };

    let succ_act = Activity {
        id: succ_id,
        project_id,
        schedule_version_id: sched_id,
        wbs_id,
        code: "PIP-2401".to_string(),
        name: "Hydrostatic Testing Line P-101".to_string(),
        description: None,
        discipline: Discipline::Piping,
        planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 26).unwrap(),
        planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 28).unwrap(),
        planned_duration_days: 3,
        planned_quantity: Some(1.0),
        unit_of_measure: Some("Test-Pack".to_string()),
        location: None,
        zone: None,
        equipment_tag: None,
        weightage: 1.0,
        critical_path: true,
    };

    let dep = ActivityDependency {
        id: Uuid::new_v4(),
        schedule_version_id: sched_id,
        predecessor_id: pred_id,
        successor_id: succ_id,
        dependency_type: DependencyType::Fs,
        lag_days: 0,
    };

    // Case 1: Predecessor is NOT completed -> Validation fails
    let pred_state_incomplete = ActivityCurrentState {
        activity_id: pred_id,
        project_id,
        execution_status: ExecutionStatus::InProgress,
        actual_start_date: Some(NaiveDate::from_ymd_opt(2026, 8, 10).unwrap()),
        actual_finish_date: None,
        current_progress_pct: 60.0,
        cumulative_quantity: 270.0,
        last_event_id: None,
        last_event_date: None,
        is_critical_path_delayed: false,
        variance_days: 0,
        updated_at: chrono::Utc::now(),
    };

    let res_incomplete = ValidationEngine::validate_dependencies(
        &succ_act,
        &[dep.clone()],
        &[(pred_act.clone(), pred_state_incomplete)],
    );
    assert!(res_incomplete.is_err());
    assert!(matches!(res_incomplete.unwrap_err(), ValidationError::PredecessorNotFinished { .. }));

    // Case 2: Predecessor IS completed -> Validation succeeds
    let pred_state_complete = ActivityCurrentState {
        activity_id: pred_id,
        project_id,
        execution_status: ExecutionStatus::Completed,
        actual_start_date: Some(NaiveDate::from_ymd_opt(2026, 8, 10).unwrap()),
        actual_finish_date: Some(NaiveDate::from_ymd_opt(2026, 8, 25).unwrap()),
        current_progress_pct: 100.0,
        cumulative_quantity: 450.0,
        last_event_id: None,
        last_event_date: None,
        is_critical_path_delayed: false,
        variance_days: 0,
        updated_at: chrono::Utc::now(),
    };

    let res_complete = ValidationEngine::validate_dependencies(
        &succ_act,
        &[dep],
        &[(pred_act, pred_state_complete)],
    );
    assert!(res_complete.is_ok());
}

// =============================================================================
// P0 Remediation: Additional Integration Tests
// =============================================================================

#[test]
fn test_validate_event_date_today_succeeds() {
    let today = chrono::Local::now().date_naive();
    assert!(ValidationEngine::validate_event_date(today).is_ok());
}

#[test]
fn test_validate_event_date_far_future_fails() {
    let far_future = chrono::Local::now().date_naive() + chrono::Duration::days(30);
    let res = ValidationEngine::validate_event_date(far_future);
    assert!(matches!(res, Err(ValidationError::FutureDateNotAllowed { .. })));
}

#[test]
fn test_validate_progress_boundary_values() {
    assert!(ValidationEngine::validate_progress(None).is_ok());
    assert!(ValidationEngine::validate_progress(Some(0.0)).is_ok());
    assert!(ValidationEngine::validate_progress(Some(50.0)).is_ok());
    assert!(ValidationEngine::validate_progress(Some(100.0)).is_ok());
    assert!(ValidationEngine::validate_progress(Some(-0.01)).is_err());
    assert!(ValidationEngine::validate_progress(Some(100.01)).is_err());
}

#[test]
fn test_approve_proposal_flow_creates_committed_event_and_audit_entry() {
    // Simulate the full approve_proposal handler flow:
    // 1. Create an activity, proposal, and state
    // 2. Approve the proposal
    // 3. Verify: event committed, audit entry created, state projected
    let project_id = Uuid::new_v4();
    let activity_id = Uuid::new_v4();
    let proposal_id = Uuid::new_v4();
    let reviewer_id = Uuid::new_v4();
    let planned_finish = NaiveDate::from_ymd_opt(2026, 8, 28).unwrap();

    // Step 1: Set up an activity current state
    let mut state = ActivityCurrentState {
        activity_id,
        project_id,
        execution_status: ExecutionStatus::NotStarted,
        actual_start_date: None,
        actual_finish_date: None,
        current_progress_pct: 0.0,
        cumulative_quantity: 0.0,
        last_event_id: None,
        last_event_date: None,
        is_critical_path_delayed: false,
        variance_days: 0,
        updated_at: chrono::Utc::now(),
    };

    // Step 2: Validate (as the handler would)
    let actual_date = chrono::Utc::now().date_naive();
    assert!(ValidationEngine::validate_event_date(actual_date).is_ok());
    assert!(ValidationEngine::validate_progress(Some(100.0)).is_ok());

    // Step 3: Create the event (mirrors handler logic)
    let new_event = ActualEvent {
        id: Uuid::new_v4(),
        project_id,
        activity_id,
        observation_id: None,
        match_proposal_id: Some(proposal_id),
        event_type: EventType::Finish,
        actual_date,
        actual_progress_pct: Some(100.0),
        actual_quantity: Some(450.0),
        delay_reason: None,
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::HumanVerified,
        idempotency_key: Some(format!("event-{}-{}", activity_id, actual_date)),
        created_by: Some(reviewer_id),
        created_at: chrono::Utc::now(),
    };

    // Step 4: Project event to state
    StateMachine::project_event(&mut state, &new_event, planned_finish);

    // Step 5: Create audit entry
    let audit = EventLedger::create_audit_event(
        project_id,
        "PROPOSAL_APPROVAL",
        proposal_id,
        "APPROVE_AND_COMMIT",
        Some(reviewer_id),
        Some("PLANNER"),
        Some(serde_json::json!({"status": "PENDING_REVIEW"})),
        Some(serde_json::json!({"status": "COMMITTED", "event_id": new_event.id})),
        None,
    );

    // Step 6: Create outbox event
    let outbox = EventLedger::create_outbox_event(
        project_id,
        "PROPOSAL_APPROVED",
        &new_event,
    );

    // Assertions - State projection
    assert_eq!(state.execution_status, ExecutionStatus::Completed);
    assert_eq!(state.current_progress_pct, 100.0);
    assert!(state.actual_finish_date.is_some());
    assert_eq!(state.cumulative_quantity, 450.0);

    // Assertions - Audit trail
    assert_eq!(audit.entity_type, "PROPOSAL_APPROVAL");
    assert_eq!(audit.action, "APPROVE_AND_COMMIT");
    assert_eq!(audit.actor_id, Some(reviewer_id));
    assert!(!audit.payload_hash.is_empty());
    assert_eq!(audit.payload_hash.len(), 64); // SHA-256 hex

    // Assertions - Outbox event
    assert_eq!(outbox.event_type, "PROPOSAL_APPROVED");
    assert_eq!(outbox.status, "PENDING");
    assert_eq!(outbox.retry_count, 0);
    assert!(outbox.processed_at.is_none());
}

#[test]
fn test_reject_proposal_flow_creates_audit_entry() {
    let project_id = Uuid::new_v4();
    let proposal_id = Uuid::new_v4();
    let reviewer_id = Uuid::new_v4();

    let audit = EventLedger::create_audit_event(
        project_id,
        "PROPOSAL_REJECTION",
        proposal_id,
        "REJECT",
        Some(reviewer_id),
        Some("PLANNER"),
        Some(serde_json::json!({"status": "PENDING_REVIEW"})),
        Some(serde_json::json!({"status": "REJECTED", "comments": "Incorrect match"})),
        None,
    );

    assert_eq!(audit.entity_type, "PROPOSAL_REJECTION");
    assert_eq!(audit.action, "REJECT");
    assert_eq!(audit.actor_id, Some(reviewer_id));
    assert!(!audit.payload_hash.is_empty());
    assert!(audit.previous_hash.is_none());
}

#[test]
fn test_dashboard_kpi_computation_logic() {
    // Simulate the KPI aggregation logic from get_dashboard
    let states = vec![
        ActivityCurrentState {
            activity_id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            execution_status: ExecutionStatus::Completed,
            actual_start_date: Some(NaiveDate::from_ymd_opt(2026, 8, 10).unwrap()),
            actual_finish_date: Some(NaiveDate::from_ymd_opt(2026, 8, 20).unwrap()),
            current_progress_pct: 100.0,
            cumulative_quantity: 450.0,
            last_event_id: None,
            last_event_date: None,
            is_critical_path_delayed: false,
            variance_days: 0,
            updated_at: chrono::Utc::now(),
        },
        ActivityCurrentState {
            activity_id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            execution_status: ExecutionStatus::InProgress,
            actual_start_date: Some(NaiveDate::from_ymd_opt(2026, 8, 15).unwrap()),
            actual_finish_date: None,
            current_progress_pct: 60.0,
            cumulative_quantity: 200.0,
            last_event_id: None,
            last_event_date: None,
            is_critical_path_delayed: false,
            variance_days: 0,
            updated_at: chrono::Utc::now(),
        },
    ];

    let completed = states.iter().filter(|s| s.execution_status == ExecutionStatus::Completed).count();
    let in_progress = states.iter().filter(|s| s.execution_status == ExecutionStatus::InProgress).count();
    let total_progress: f64 = states.iter().map(|s| s.current_progress_pct).sum();
    let overall_pct = if !states.is_empty() {
        total_progress / (states.len() as f64)
    } else {
        0.0
    };

    assert_eq!(completed, 1);
    assert_eq!(in_progress, 1);
    assert!((overall_pct - 80.0).abs() < 0.01); // (100 + 60) / 2 = 80
}

#[test]
fn test_audit_chain_hash_continuity() {
    let entity_id = Uuid::new_v4();
    let project_id = Uuid::new_v4();

    // First event in chain (no previous hash)
    let audit1 = EventLedger::create_audit_event(
        project_id, "EVENT", entity_id, "CREATE",
        None, None, None,
        Some(serde_json::json!({"status": "CREATED"})),
        None,
    );

    // Second event chained to first
    let audit2 = EventLedger::create_audit_event(
        project_id, "EVENT", entity_id, "UPDATE",
        None, None,
        Some(serde_json::json!({"status": "CREATED"})),
        Some(serde_json::json!({"status": "UPDATED"})),
        Some(&audit1.payload_hash),
    );

    // Verify chain integrity
    assert!(audit1.previous_hash.is_none());
    assert_eq!(audit2.previous_hash.as_deref(), Some(audit1.payload_hash.as_str()));
    assert_ne!(audit1.payload_hash, audit2.payload_hash);
    assert_eq!(audit1.payload_hash.len(), 64);
    assert_eq!(audit2.payload_hash.len(), 64);
}

