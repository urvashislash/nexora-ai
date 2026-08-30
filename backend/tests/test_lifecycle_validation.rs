use chrono::{NaiveDate, Utc};
use uuid::Uuid;

#[path = "../src/domain/models.rs"]
mod models;
#[path = "../src/domain/state_machine.rs"]
mod state_machine;
#[path = "../src/domain/validation.rs"]
mod validation;

use models::{
    Activity, ActivityCurrentState, ActivityDependency, DependencyType, EventType,
    ExecutionStatus, LifecycleStatus, ActualEvent, VerificationStatus, Discipline,
};
use state_machine::StateMachine;
use validation::{ValidationEngine, ValidationError};

#[test]
fn test_lifecycle_validation_fs_dependency() {
    let pred_id = Uuid::new_v4();
    let succ_id = Uuid::new_v4();
    let project_id = Uuid::new_v4();

    let pred_act = Activity {
        id: pred_id,
        project_id,
        schedule_version_id: Uuid::new_v4(),
        wbs_id: Uuid::new_v4(),
        code: "PRED-1".to_string(),
        name: "Predecessor".to_string(),
        description: None,
        discipline: Discipline::Civil,
        planned_start_date: NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(),
        planned_finish_date: NaiveDate::from_ymd_opt(2026, 1, 10).unwrap(),
        planned_duration_days: 10,
        planned_quantity: None,
        unit_of_measure: None,
        location: None,
        zone: None,
        equipment_tag: None,
        weightage: 1.0,
        critical_path: false,
    };

    let mut pred_state = ActivityCurrentState {
        activity_id: pred_id,
        project_id,
        execution_status: ExecutionStatus::InProgress,
        actual_start_date: Some(NaiveDate::from_ymd_opt(2026, 1, 1).unwrap()),
        actual_finish_date: None,
        current_progress_pct: 50.0,
        cumulative_quantity: 0.0,
        last_event_id: None,
        last_event_date: None,
        is_critical_path_delayed: false,
        variance_days: 0,
        updated_at: Utc::now(),
    };

    let succ_act = Activity {
        id: succ_id,
        project_id,
        schedule_version_id: Uuid::new_v4(),
        wbs_id: Uuid::new_v4(),
        code: "SUCC-1".to_string(),
        name: "Successor".to_string(),
        description: None,
        discipline: Discipline::Civil,
        planned_start_date: NaiveDate::from_ymd_opt(2026, 1, 11).unwrap(),
        planned_finish_date: NaiveDate::from_ymd_opt(2026, 1, 20).unwrap(),
        planned_duration_days: 10,
        planned_quantity: None,
        unit_of_measure: None,
        location: None,
        zone: None,
        equipment_tag: None,
        weightage: 1.0,
        critical_path: false,
    };

    let dep = ActivityDependency {
        id: Uuid::new_v4(),
        schedule_version_id: Uuid::new_v4(),
        predecessor_id: pred_id,
        successor_id: succ_id,
        dependency_type: DependencyType::Fs,
        lag_days: 0,
    };

    // Test: Successor cannot start because Predecessor is not finished
    let validation_result = ValidationEngine::validate_dependencies(
        &succ_act,
        &[dep.clone()],
        &[(pred_act.clone(), pred_state.clone())],
    );

    assert!(matches!(
        validation_result,
        Err(ValidationError::PredecessorNotFinished { .. })
    ));

    // Update Predecessor to Completed
    pred_state.execution_status = ExecutionStatus::Completed;
    pred_state.current_progress_pct = 100.0;

    // Test: Successor can now start
    let validation_result_ok = ValidationEngine::validate_dependencies(
        &succ_act,
        &[dep],
        &[(pred_act, pred_state)],
    );

    assert!(validation_result_ok.is_ok());
}

#[test]
fn test_state_machine_progress_projection() {
    let act_id = Uuid::new_v4();
    let project_id = Uuid::new_v4();

    let mut state = ActivityCurrentState {
        activity_id: act_id,
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

    let start_event = ActualEvent {
        id: Uuid::new_v4(),
        project_id,
        activity_id: act_id,
        observation_id: None,
        match_proposal_id: None,
        event_type: EventType::Start,
        actual_date: NaiveDate::from_ymd_opt(2026, 2, 1).unwrap(),
        actual_progress_pct: Some(0.0),
        actual_quantity: None,
        delay_reason: None,
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::HumanVerified,
        idempotency_key: None,
        created_by: None,
        created_at: Utc::now(),
    };

    // Apply start event
    let _ = StateMachine::project_event(&mut state, &start_event, NaiveDate::from_ymd_opt(2026, 2, 1).unwrap());
    assert_eq!(state.execution_status, ExecutionStatus::InProgress);
    assert_eq!(state.actual_start_date, Some(NaiveDate::from_ymd_opt(2026, 2, 1).unwrap()));

    let progress_event = ActualEvent {
        id: Uuid::new_v4(),
        project_id,
        activity_id: act_id,
        observation_id: None,
        match_proposal_id: None,
        event_type: EventType::Progress,
        actual_date: NaiveDate::from_ymd_opt(2026, 2, 5).unwrap(),
        actual_progress_pct: Some(50.0),
        actual_quantity: None,
        delay_reason: None,
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::HumanVerified,
        idempotency_key: None,
        created_by: None,
        created_at: Utc::now(),
    };

    // Apply progress event
    let _ = StateMachine::project_event(&mut state, &progress_event, NaiveDate::from_ymd_opt(2026, 2, 10).unwrap());
    assert_eq!(state.execution_status, ExecutionStatus::InProgress);
    assert_eq!(state.current_progress_pct, 50.0);

    let finish_event = ActualEvent {
        id: Uuid::new_v4(),
        project_id,
        activity_id: act_id,
        observation_id: None,
        match_proposal_id: None,
        event_type: EventType::Finish,
        actual_date: NaiveDate::from_ymd_opt(2026, 2, 10).unwrap(),
        actual_progress_pct: Some(100.0),
        actual_quantity: None,
        delay_reason: None,
        delay_days: None,
        lifecycle_status: LifecycleStatus::Committed,
        verification_status: VerificationStatus::HumanVerified,
        idempotency_key: None,
        created_by: None,
        created_at: Utc::now(),
    };

    // Apply finish event
    let _ = StateMachine::project_event(&mut state, &finish_event, NaiveDate::from_ymd_opt(2026, 2, 10).unwrap());
    assert_eq!(state.execution_status, ExecutionStatus::Completed);
    assert_eq!(state.current_progress_pct, 100.0);
    assert_eq!(state.actual_finish_date, Some(NaiveDate::from_ymd_opt(2026, 2, 10).unwrap()));
}
