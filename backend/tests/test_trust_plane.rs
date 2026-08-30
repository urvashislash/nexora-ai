use chrono::{Local, NaiveDate, Utc};
use serde_json::json;
use uuid::Uuid;

// Import domain logic
#[path = "../src/domain/ledger.rs"]
mod ledger;
#[path = "../src/domain/models.rs"]
mod models;
#[path = "../src/domain/state_machine.rs"]
mod state_machine;
#[path = "../src/domain/validation.rs"]
mod validation;

use ledger::*;
use models::*;
use state_machine::*;
use validation::*;

// =============================================================================
// Core End-to-End Demonstration Scenarios
// =============================================================================

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
        updated_at: Utc::now(),
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
        created_at: Utc::now(),
    };

    StateMachine::project_event(&mut state, &event, planned_finish);

    assert_eq!(state.execution_status, ExecutionStatus::Completed);
    assert_eq!(state.current_progress_pct, 100.0);
    assert_eq!(
        state.actual_finish_date,
        Some(NaiveDate::from_ymd_opt(2026, 8, 28).unwrap())
    );
    assert_eq!(state.variance_days, 0);
}

#[test]
fn test_scenario_e_invalid_date_sequence_rejected() {
    let start = NaiveDate::from_ymd_opt(2026, 8, 28);
    let finish = NaiveDate::from_ymd_opt(2026, 8, 20);

    let res = ValidationEngine::validate_date_sequence(start, finish);
    assert!(res.is_err());
    assert!(matches!(
        res.unwrap_err(),
        ValidationError::FinishBeforeStart { .. }
    ));
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
        updated_at: Utc::now(),
    };

    let res_incomplete = ValidationEngine::validate_dependencies(
        &succ_act,
        std::slice::from_ref(&dep),
        &[(pred_act.clone(), pred_state_incomplete)],
    );
    assert!(res_incomplete.is_err());
    assert!(matches!(
        res_incomplete.unwrap_err(),
        ValidationError::PredecessorNotFinished { .. }
    ));

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
        updated_at: Utc::now(),
    };

    let res_complete = ValidationEngine::validate_dependencies(
        &succ_act,
        &[dep],
        &[(pred_act, pred_state_complete)],
    );
    assert!(res_complete.is_ok());
}

// =============================================================================
// State Machine Lifecycle Transitions Tests
// =============================================================================

#[test]
fn test_state_machine_valid_full_lifecycle() {
    // Proposed -> Matched -> Approved -> Committed
    let s1 =
        StateMachine::transition_lifecycle(LifecycleStatus::Proposed, LifecycleStatus::Matched)
            .unwrap();
    assert_eq!(s1, LifecycleStatus::Matched);

    let s2 = StateMachine::transition_lifecycle(s1, LifecycleStatus::Approved).unwrap();
    assert_eq!(s2, LifecycleStatus::Approved);

    let s3 = StateMachine::transition_lifecycle(s2, LifecycleStatus::Committed).unwrap();
    assert_eq!(s3, LifecycleStatus::Committed);
}

#[test]
fn test_state_machine_valid_review_required_path() {
    // Proposed -> ReviewRequired -> Approved
    let s1 = StateMachine::transition_lifecycle(
        LifecycleStatus::Proposed,
        LifecycleStatus::ReviewRequired,
    )
    .unwrap();
    assert_eq!(s1, LifecycleStatus::ReviewRequired);

    let s2 = StateMachine::transition_lifecycle(s1, LifecycleStatus::Approved).unwrap();
    assert_eq!(s2, LifecycleStatus::Approved);
}

#[test]
fn test_state_machine_rejection_paths() {
    // Proposed -> Rejected
    assert!(StateMachine::transition_lifecycle(
        LifecycleStatus::Proposed,
        LifecycleStatus::Rejected
    )
    .is_ok());
    // Matched -> Rejected
    assert!(StateMachine::transition_lifecycle(
        LifecycleStatus::Matched,
        LifecycleStatus::Rejected
    )
    .is_ok());
    // ReviewRequired -> Rejected
    assert!(StateMachine::transition_lifecycle(
        LifecycleStatus::ReviewRequired,
        LifecycleStatus::Rejected
    )
    .is_ok());
    // Approved -> Rejected
    assert!(StateMachine::transition_lifecycle(
        LifecycleStatus::Approved,
        LifecycleStatus::Rejected
    )
    .is_ok());
}

#[test]
fn test_state_machine_invalid_backwards_transitions() {
    // Committed cannot transition back to anything
    assert!(StateMachine::transition_lifecycle(
        LifecycleStatus::Committed,
        LifecycleStatus::Proposed
    )
    .is_err());
    assert!(StateMachine::transition_lifecycle(
        LifecycleStatus::Committed,
        LifecycleStatus::Matched
    )
    .is_err());
    assert!(StateMachine::transition_lifecycle(
        LifecycleStatus::Committed,
        LifecycleStatus::Approved
    )
    .is_err());

    // Rejected cannot transition back to Proposed or Approved
    assert!(StateMachine::transition_lifecycle(
        LifecycleStatus::Rejected,
        LifecycleStatus::Proposed
    )
    .is_err());
    assert!(StateMachine::transition_lifecycle(
        LifecycleStatus::Rejected,
        LifecycleStatus::Approved
    )
    .is_err());
}

// =============================================================================
// State Machine Event Projections Tests
// =============================================================================

#[test]
fn test_project_event_start_type() {
    let mut state = ActivityCurrentState {
        activity_id: Uuid::new_v4(),
        project_id: Uuid::new_v4(),
        execution_status: ExecutionStatus::NotStarted,
        actual_start_date: None,
        actual_finish_date: None,
        current_progress_pct: 0.0,
        cumulative_quantity: 0.0,
        last_event_id: None,
        last_event_date: None,
        is_critical_path_delayed: false,
        variance_days: 0,
        updated_at: Utc::now(),
    };

    let event = ActualEvent {
        id: Uuid::new_v4(),
        project_id: state.project_id,
        activity_id: state.activity_id,
        observation_id: None,
        match_proposal_id: None,
        event_type: EventType::Start,
        actual_date: NaiveDate::from_ymd_opt(2026, 8, 12).unwrap(),
        actual_progress_pct: Some(10.0),
        actual_quantity: Some(50.0),
        delay_reason: None,
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::SystemVerified,
        idempotency_key: None,
        created_by: None,
        created_at: Utc::now(),
    };

    StateMachine::project_event(
        &mut state,
        &event,
        NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
    );

    assert_eq!(state.execution_status, ExecutionStatus::InProgress);
    assert_eq!(
        state.actual_start_date,
        Some(NaiveDate::from_ymd_opt(2026, 8, 12).unwrap())
    );
    assert_eq!(state.current_progress_pct, 10.0);
    assert_eq!(state.cumulative_quantity, 50.0);
}

#[test]
fn test_project_event_progress_type_partial() {
    let mut state = ActivityCurrentState {
        activity_id: Uuid::new_v4(),
        project_id: Uuid::new_v4(),
        execution_status: ExecutionStatus::InProgress,
        actual_start_date: Some(NaiveDate::from_ymd_opt(2026, 8, 10).unwrap()),
        actual_finish_date: None,
        current_progress_pct: 20.0,
        cumulative_quantity: 100.0,
        last_event_id: None,
        last_event_date: None,
        is_critical_path_delayed: false,
        variance_days: 0,
        updated_at: Utc::now(),
    };

    let event = ActualEvent {
        id: Uuid::new_v4(),
        project_id: state.project_id,
        activity_id: state.activity_id,
        observation_id: None,
        match_proposal_id: None,
        event_type: EventType::Progress,
        actual_date: NaiveDate::from_ymd_opt(2026, 8, 18).unwrap(),
        actual_progress_pct: Some(65.0),
        actual_quantity: Some(200.0),
        delay_reason: None,
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::SystemVerified,
        idempotency_key: None,
        created_by: None,
        created_at: Utc::now(),
    };

    StateMachine::project_event(
        &mut state,
        &event,
        NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
    );

    assert_eq!(state.execution_status, ExecutionStatus::InProgress);
    assert_eq!(state.current_progress_pct, 65.0);
    assert_eq!(state.cumulative_quantity, 300.0);
    assert!(state.actual_finish_date.is_none());
}

#[test]
fn test_project_event_progress_type_100_completes() {
    let mut state = ActivityCurrentState {
        activity_id: Uuid::new_v4(),
        project_id: Uuid::new_v4(),
        execution_status: ExecutionStatus::InProgress,
        actual_start_date: Some(NaiveDate::from_ymd_opt(2026, 8, 10).unwrap()),
        actual_finish_date: None,
        current_progress_pct: 80.0,
        cumulative_quantity: 350.0,
        last_event_id: None,
        last_event_date: None,
        is_critical_path_delayed: false,
        variance_days: 0,
        updated_at: Utc::now(),
    };

    let event = ActualEvent {
        id: Uuid::new_v4(),
        project_id: state.project_id,
        activity_id: state.activity_id,
        observation_id: None,
        match_proposal_id: None,
        event_type: EventType::Progress,
        actual_date: NaiveDate::from_ymd_opt(2026, 8, 24).unwrap(),
        actual_progress_pct: Some(100.0),
        actual_quantity: Some(100.0),
        delay_reason: None,
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::SystemVerified,
        idempotency_key: None,
        created_by: None,
        created_at: Utc::now(),
    };

    StateMachine::project_event(
        &mut state,
        &event,
        NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
    );

    assert_eq!(state.execution_status, ExecutionStatus::Completed);
    assert_eq!(state.current_progress_pct, 100.0);
    assert_eq!(
        state.actual_finish_date,
        Some(NaiveDate::from_ymd_opt(2026, 8, 24).unwrap())
    );
    assert_eq!(state.cumulative_quantity, 450.0);
}

#[test]
fn test_project_event_delay_variance_accumulation() {
    let mut state = ActivityCurrentState {
        activity_id: Uuid::new_v4(),
        project_id: Uuid::new_v4(),
        execution_status: ExecutionStatus::InProgress,
        actual_start_date: Some(NaiveDate::from_ymd_opt(2026, 8, 10).unwrap()),
        actual_finish_date: None,
        current_progress_pct: 30.0,
        cumulative_quantity: 100.0,
        last_event_id: None,
        last_event_date: None,
        is_critical_path_delayed: false,
        variance_days: 2,
        updated_at: Utc::now(),
    };

    let event = ActualEvent {
        id: Uuid::new_v4(),
        project_id: state.project_id,
        activity_id: state.activity_id,
        observation_id: None,
        match_proposal_id: None,
        event_type: EventType::Delay,
        actual_date: NaiveDate::from_ymd_opt(2026, 8, 15).unwrap(),
        actual_progress_pct: None,
        actual_quantity: None,
        delay_reason: Some("Heavy rain".to_string()),
        delay_days: Some(3),
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::SystemVerified,
        idempotency_key: None,
        created_by: None,
        created_at: Utc::now(),
    };

    StateMachine::project_event(
        &mut state,
        &event,
        NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
    );

    assert_eq!(state.execution_status, ExecutionStatus::Delayed);
    assert_eq!(state.variance_days, 5); // 2 + 3
}

#[test]
fn test_project_event_blocker_status() {
    let mut state = ActivityCurrentState {
        activity_id: Uuid::new_v4(),
        project_id: Uuid::new_v4(),
        execution_status: ExecutionStatus::InProgress,
        actual_start_date: Some(NaiveDate::from_ymd_opt(2026, 8, 10).unwrap()),
        actual_finish_date: None,
        current_progress_pct: 40.0,
        cumulative_quantity: 150.0,
        last_event_id: None,
        last_event_date: None,
        is_critical_path_delayed: false,
        variance_days: 0,
        updated_at: Utc::now(),
    };

    let event = ActualEvent {
        id: Uuid::new_v4(),
        project_id: state.project_id,
        activity_id: state.activity_id,
        observation_id: None,
        match_proposal_id: None,
        event_type: EventType::Blocker,
        actual_date: NaiveDate::from_ymd_opt(2026, 8, 16).unwrap(),
        actual_progress_pct: None,
        actual_quantity: None,
        delay_reason: Some("Material shortage".to_string()),
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::SystemVerified,
        idempotency_key: None,
        created_by: None,
        created_at: Utc::now(),
    };

    StateMachine::project_event(
        &mut state,
        &event,
        NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
    );

    assert_eq!(state.execution_status, ExecutionStatus::Blocked);
}

// =============================================================================
// Validation Engine Additional Edge Cases
// =============================================================================

#[test]
fn test_validate_date_sequence_none_inputs_succeed() {
    assert!(ValidationEngine::validate_date_sequence(None, None).is_ok());
    assert!(ValidationEngine::validate_date_sequence(
        Some(NaiveDate::from_ymd_opt(2026, 8, 10).unwrap()),
        None
    )
    .is_ok());
    assert!(ValidationEngine::validate_date_sequence(
        None,
        Some(NaiveDate::from_ymd_opt(2026, 8, 20).unwrap())
    )
    .is_ok());
}

#[test]
fn test_validate_date_sequence_same_day_succeeds() {
    let day = NaiveDate::from_ymd_opt(2026, 8, 15);
    assert!(ValidationEngine::validate_date_sequence(day, day).is_ok());
}

#[test]
fn test_validate_event_date_today_succeeds() {
    let today = Local::now().date_naive();
    assert!(ValidationEngine::validate_event_date(today).is_ok());
}

#[test]
fn test_validate_event_date_tomorrow_tolerance_succeeds() {
    let tomorrow = Local::now().date_naive() + chrono::Duration::days(1);
    assert!(ValidationEngine::validate_event_date(tomorrow).is_ok());
}

#[test]
fn test_validate_event_date_far_future_fails() {
    let far_future = Local::now().date_naive() + chrono::Duration::days(30);
    let res = ValidationEngine::validate_event_date(far_future);
    assert!(matches!(
        res,
        Err(ValidationError::FutureDateNotAllowed { .. })
    ));
}

#[test]
fn test_validate_progress_boundary_values() {
    assert!(ValidationEngine::validate_progress(None).is_ok());
    assert!(ValidationEngine::validate_progress(Some(0.0)).is_ok());
    assert!(ValidationEngine::validate_progress(Some(0.001)).is_ok());
    assert!(ValidationEngine::validate_progress(Some(50.0)).is_ok());
    assert!(ValidationEngine::validate_progress(Some(99.999)).is_ok());
    assert!(ValidationEngine::validate_progress(Some(100.0)).is_ok());
    assert!(ValidationEngine::validate_progress(Some(-0.01)).is_err());
    assert!(ValidationEngine::validate_progress(Some(100.01)).is_err());
    assert!(ValidationEngine::validate_progress(Some(999.0)).is_err());
}

// =============================================================================
// Ledger & Audit Chaining Tests
// =============================================================================

#[test]
fn test_audit_hash_deterministic_across_calls() {
    let entity_id = Uuid::new_v4();
    let payload = json!({"status": "COMPLETED", "progress": 100.0});
    let hash_a = EventLedger::compute_hash(&entity_id, "APPROVE", &payload, Some("prev_123"));
    let hash_b = EventLedger::compute_hash(&entity_id, "APPROVE", &payload, Some("prev_123"));
    assert_eq!(hash_a, hash_b);
}

#[test]
fn test_audit_hash_differs_when_payload_changes() {
    let entity_id = Uuid::new_v4();
    let p1 = json!({"progress": 50.0});
    let p2 = json!({"progress": 60.0});
    let hash1 = EventLedger::compute_hash(&entity_id, "UPDATE", &p1, None);
    let hash2 = EventLedger::compute_hash(&entity_id, "UPDATE", &p2, None);
    assert_ne!(hash1, hash2);
}

#[test]
fn test_audit_hash_differs_when_previous_hash_changes() {
    let entity_id = Uuid::new_v4();
    let p = json!({"status": "COMMITTED"});
    let hash_chain_a = EventLedger::compute_hash(&entity_id, "COMMIT", &p, Some("hash_001"));
    let hash_chain_b = EventLedger::compute_hash(&entity_id, "COMMIT", &p, Some("hash_002"));
    assert_ne!(hash_chain_a, hash_chain_b);
}

#[test]
fn test_create_outbox_event_structure() {
    let project_id = Uuid::new_v4();
    let event = ActualEvent {
        id: Uuid::new_v4(),
        project_id,
        activity_id: Uuid::new_v4(),
        observation_id: None,
        match_proposal_id: None,
        event_type: EventType::Finish,
        actual_date: NaiveDate::from_ymd_opt(2026, 8, 28).unwrap(),
        actual_progress_pct: Some(100.0),
        actual_quantity: Some(450.0),
        delay_reason: None,
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::HumanVerified,
        idempotency_key: Some("test-key".to_string()),
        created_by: None,
        created_at: Utc::now(),
    };

    let outbox = EventLedger::create_outbox_event(project_id, "P6_SYNC", &event);
    assert_eq!(outbox.project_id, project_id);
    assert_eq!(outbox.event_type, "P6_SYNC");
    assert_eq!(outbox.status, "PENDING");
    assert_eq!(outbox.retry_count, 0);
    assert!(outbox.processed_at.is_none());
}

#[test]
fn test_audit_chain_hash_continuity() {
    let entity_id = Uuid::new_v4();
    let project_id = Uuid::new_v4();

    // First event in chain (no previous hash)
    let audit1 = EventLedger::create_audit_event(
        project_id,
        "EVENT",
        entity_id,
        "CREATE",
        None,
        None,
        None,
        Some(json!({"status": "CREATED"})),
        None,
    );

    // Second event chained to first
    let audit2 = EventLedger::create_audit_event(
        project_id,
        "EVENT",
        entity_id,
        "UPDATE",
        None,
        None,
        Some(json!({"status": "CREATED"})),
        Some(json!({"status": "UPDATED"})),
        Some(&audit1.payload_hash),
    );

    // Verify chain integrity
    assert!(audit1.previous_hash.is_none());
    assert_eq!(
        audit2.previous_hash.as_deref(),
        Some(audit1.payload_hash.as_str())
    );
    assert_ne!(audit1.payload_hash, audit2.payload_hash);
    assert_eq!(audit1.payload_hash.len(), 64);
    assert_eq!(audit2.payload_hash.len(), 64);
}

// =============================================================================
// Handler Simulation & KPI Logic Tests
// =============================================================================

#[test]
fn test_approve_proposal_flow_creates_committed_event_and_audit_entry() {
    let project_id = Uuid::new_v4();
    let activity_id = Uuid::new_v4();
    let proposal_id = Uuid::new_v4();
    let reviewer_id = Uuid::new_v4();
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
        updated_at: Utc::now(),
    };

    let actual_date = Utc::now().date_naive();
    assert!(ValidationEngine::validate_event_date(actual_date).is_ok());
    assert!(ValidationEngine::validate_progress(Some(100.0)).is_ok());

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
        created_at: Utc::now(),
    };

    StateMachine::project_event(&mut state, &new_event, planned_finish);

    let audit = EventLedger::create_audit_event(
        project_id,
        "PROPOSAL_APPROVAL",
        proposal_id,
        "APPROVE_AND_COMMIT",
        Some(reviewer_id),
        Some("PLANNER"),
        Some(json!({"status": "PENDING_REVIEW"})),
        Some(json!({"status": "COMMITTED", "event_id": new_event.id})),
        None,
    );

    let outbox = EventLedger::create_outbox_event(project_id, "PROPOSAL_APPROVED", &new_event);

    assert_eq!(state.execution_status, ExecutionStatus::Completed);
    assert_eq!(state.current_progress_pct, 100.0);
    assert!(state.actual_finish_date.is_some());
    assert_eq!(state.cumulative_quantity, 450.0);

    assert_eq!(audit.entity_type, "PROPOSAL_APPROVAL");
    assert_eq!(audit.action, "APPROVE_AND_COMMIT");
    assert_eq!(audit.actor_id, Some(reviewer_id));
    assert_eq!(audit.payload_hash.len(), 64);

    assert_eq!(outbox.event_type, "PROPOSAL_APPROVED");
    assert_eq!(outbox.status, "PENDING");
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
        Some(json!({"status": "PENDING_REVIEW"})),
        Some(json!({"status": "REJECTED", "comments": "Incorrect match"})),
        None,
    );

    assert_eq!(audit.entity_type, "PROPOSAL_REJECTION");
    assert_eq!(audit.action, "REJECT");
    assert_eq!(audit.actor_id, Some(reviewer_id));
    assert_eq!(audit.payload_hash.len(), 64);
}

#[test]
fn test_dashboard_kpi_computation_logic() {
    let states = [
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
            updated_at: Utc::now(),
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
            updated_at: Utc::now(),
        },
    ];

    let completed = states
        .iter()
        .filter(|s| s.execution_status == ExecutionStatus::Completed)
        .count();
    let in_progress = states
        .iter()
        .filter(|s| s.execution_status == ExecutionStatus::InProgress)
        .count();
    let total_progress: f64 = states.iter().map(|s| s.current_progress_pct).sum();
    let overall_pct = if !states.is_empty() {
        total_progress / (states.len() as f64)
    } else {
        0.0
    };

    assert_eq!(completed, 1);
    assert_eq!(in_progress, 1);
    assert!((overall_pct - 80.0).abs() < 0.01);
}

// =============================================================================
// Serialization and Model Mapping Tests
// =============================================================================

#[test]
fn test_serde_discipline_serialization() {
    let d = Discipline::Piping;
    let json_str = serde_json::to_string(&d).unwrap();
    assert_eq!(json_str, "\"PIPING\"");

    let deserialized: Discipline = serde_json::from_str(&json_str).unwrap();
    assert_eq!(deserialized, Discipline::Piping);
}

#[test]
fn test_serde_execution_status_serialization() {
    let s = ExecutionStatus::InProgress;
    let json_str = serde_json::to_string(&s).unwrap();
    assert_eq!(json_str, "\"IN_PROGRESS\"");

    let deserialized: ExecutionStatus = serde_json::from_str(&json_str).unwrap();
    assert_eq!(deserialized, ExecutionStatus::InProgress);
}

#[test]
fn test_serde_lifecycle_status_serialization() {
    let l = LifecycleStatus::Committed;
    let json_str = serde_json::to_string(&l).unwrap();
    assert_eq!(json_str, "\"COMMITTED\"");

    let deserialized: LifecycleStatus = serde_json::from_str(&json_str).unwrap();
    assert_eq!(deserialized, LifecycleStatus::Committed);
}

#[test]
fn test_serde_event_type_serialization() {
    let et = EventType::Finish;
    let json_str = serde_json::to_string(&et).unwrap();
    assert_eq!(json_str, "\"FINISH\"");

    let deserialized: EventType = serde_json::from_str(&json_str).unwrap();
    assert_eq!(deserialized, EventType::Finish);
}
