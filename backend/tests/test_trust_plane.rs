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
