use chrono::NaiveDate;
use thiserror::Error;

use super::models::{
    ActivityCurrentState, ActualEvent, EventType, ExecutionStatus, LifecycleStatus,
};

#[allow(dead_code)]
#[derive(Debug, Error, PartialEq, Eq)]
pub enum StateMachineError {
    #[error("Invalid lifecycle transition from {from:?} to {to:?}")]
    InvalidTransition {
        from: LifecycleStatus,
        to: LifecycleStatus,
    },

    #[error("Cannot commit an event with status {0:?}")]
    CannotCommit(LifecycleStatus),

    #[error("Backward transition from {from:?} to {to:?} is not allowed")]
    BackwardTransition {
        from: LifecycleStatus,
        to: LifecycleStatus,
    },

    #[error("Event with lifecycle status {0:?} cannot be projected — must be Committed")]
    EventNotCommitted(LifecycleStatus),
}

pub struct StateMachine;

#[allow(dead_code)]
impl StateMachine {
    /// Validates and advances lifecycle status
    pub fn transition_lifecycle(
        current: LifecycleStatus,
        target: LifecycleStatus,
    ) -> Result<LifecycleStatus, StateMachineError> {
        let is_valid = matches!(
            (current, target),
            (LifecycleStatus::Proposed, LifecycleStatus::Matched)
                | (LifecycleStatus::Proposed, LifecycleStatus::ReviewRequired)
                | (LifecycleStatus::Proposed, LifecycleStatus::Rejected)
                | (LifecycleStatus::Matched, LifecycleStatus::Approved)
                | (LifecycleStatus::Matched, LifecycleStatus::ReviewRequired)
                | (LifecycleStatus::Matched, LifecycleStatus::Committed)
                | (LifecycleStatus::Matched, LifecycleStatus::Rejected)
                | (LifecycleStatus::ReviewRequired, LifecycleStatus::Approved)
                | (LifecycleStatus::ReviewRequired, LifecycleStatus::Rejected)
                | (LifecycleStatus::Approved, LifecycleStatus::Committed)
                | (LifecycleStatus::Approved, LifecycleStatus::Rejected)
        );

        if is_valid {
            Ok(target)
        } else {
            Err(StateMachineError::InvalidTransition {
                from: current,
                to: target,
            })
        }
    }

    /// Guard: verifies that an event's lifecycle status is `Approved` (or `Matched`
    /// for auto-link flows) before allowing transition to `Committed`.
    pub fn validate_commit_readiness(
        current_status: LifecycleStatus,
    ) -> Result<(), StateMachineError> {
        match current_status {
            LifecycleStatus::Approved | LifecycleStatus::Matched => Ok(()),
            _ => Err(StateMachineError::CannotCommit(current_status)),
        }
    }

    /// Guard: prevents backward lifecycle transitions (e.g. Committed → Proposed).
    /// Returns the lifecycle ordering rank; a transition where `target_rank < current_rank`
    /// is rejected as a backward transition.
    pub fn validate_no_backward_transition(
        current: LifecycleStatus,
        target: LifecycleStatus,
    ) -> Result<(), StateMachineError> {
        let rank = |s: &LifecycleStatus| -> u8 {
            match s {
                LifecycleStatus::Proposed => 0,
                LifecycleStatus::Matched => 1,
                LifecycleStatus::ReviewRequired => 2,
                LifecycleStatus::Approved => 3,
                LifecycleStatus::Committed => 4,
                LifecycleStatus::Rejected => 5,
            }
        };
        // Rejected is a terminal state at any point, so it's always "forward"
        if target == LifecycleStatus::Rejected {
            return Ok(());
        }
        if rank(&target) < rank(&current) {
            Err(StateMachineError::BackwardTransition {
                from: current,
                to: target,
            })
        } else {
            Ok(())
        }
    }

    /// Performs a lifecycle transition and returns (before_state, after_state)
    /// as JSON values suitable for direct use in audit event creation.
    pub fn transition_with_audit(
        current: LifecycleStatus,
        target: LifecycleStatus,
    ) -> Result<(LifecycleStatus, serde_json::Value, serde_json::Value), StateMachineError> {
        let new_status = Self::transition_lifecycle(current, target)?;
        let before = serde_json::json!({"lifecycle_status": format!("{:?}", current)});
        let after = serde_json::json!({"lifecycle_status": format!("{:?}", new_status)});
        Ok((new_status, before, after))
    }

    /// Projects an approved/committed actual event onto the activity's current execution state.
    /// Returns an error if the event's lifecycle status is not `Committed`.
    pub fn project_event(
        current_state: &mut ActivityCurrentState,
        event: &ActualEvent,
        planned_finish_date: NaiveDate,
    ) -> Result<(), StateMachineError> {
        // Only committed events may affect activity state
        if event.lifecycle_status != LifecycleStatus::Committed {
            return Err(StateMachineError::EventNotCommitted(event.lifecycle_status));
        }

        current_state.last_event_id = Some(event.id);
        current_state.last_event_date = Some(event.actual_date);

        match event.event_type {
            EventType::Start => {
                if current_state.actual_start_date.is_none() {
                    current_state.actual_start_date = Some(event.actual_date);
                }
                current_state.execution_status = ExecutionStatus::InProgress;
                if let Some(pct) = event.actual_progress_pct {
                    current_state.current_progress_pct =
                        pct.max(current_state.current_progress_pct);
                }
            }
            EventType::Progress => {
                if current_state.actual_start_date.is_none() {
                    current_state.actual_start_date = Some(event.actual_date);
                }
                if let Some(pct) = event.actual_progress_pct {
                    current_state.current_progress_pct = pct;
                    if pct >= 100.0 {
                        current_state.execution_status = ExecutionStatus::Completed;
                        current_state.actual_finish_date = Some(event.actual_date);
                    } else {
                        current_state.execution_status = ExecutionStatus::InProgress;
                    }
                }
            }
            EventType::Finish => {
                if current_state.actual_start_date.is_none() {
                    current_state.actual_start_date = Some(event.actual_date);
                }
                current_state.actual_finish_date = Some(event.actual_date);
                current_state.current_progress_pct = 100.0;
                current_state.execution_status = ExecutionStatus::Completed;

                // Calculate variance vs planned finish
                let variance = (event.actual_date - planned_finish_date).num_days() as i32;
                current_state.variance_days = variance;
            }
            EventType::Delay => {
                current_state.execution_status = ExecutionStatus::Delayed;
                if let Some(days) = event.delay_days {
                    current_state.variance_days += days;
                }
            }
            EventType::Blocker => {
                current_state.execution_status = ExecutionStatus::Blocked;
            }
            EventType::Inspection => {
                // Observations / Quality signoff
            }
        }

        if let Some(qty) = event.actual_quantity {
            current_state.cumulative_quantity += qty;
        }

        current_state.updated_at = chrono::Utc::now();

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::super::models::{
        ActivityCurrentState, ActualEvent, ExecutionStatus, VerificationStatus,
    };
    use super::*;

    #[test]
    fn test_valid_transitions() {
        assert_eq!(
            StateMachine::transition_lifecycle(LifecycleStatus::Proposed, LifecycleStatus::Matched)
                .unwrap(),
            LifecycleStatus::Matched
        );
        assert_eq!(
            StateMachine::transition_lifecycle(LifecycleStatus::Matched, LifecycleStatus::Approved)
                .unwrap(),
            LifecycleStatus::Approved
        );
        assert_eq!(
            StateMachine::transition_lifecycle(
                LifecycleStatus::Approved,
                LifecycleStatus::Committed
            )
            .unwrap(),
            LifecycleStatus::Committed
        );
    }

    #[test]
    fn test_invalid_transitions() {
        let res = StateMachine::transition_lifecycle(
            LifecycleStatus::Committed,
            LifecycleStatus::Proposed,
        );
        assert!(res.is_err());
    }

    #[test]
    fn test_validate_commit_readiness_approved() {
        assert!(StateMachine::validate_commit_readiness(LifecycleStatus::Approved).is_ok());
    }

    #[test]
    fn test_validate_commit_readiness_matched_for_autolink() {
        assert!(StateMachine::validate_commit_readiness(LifecycleStatus::Matched).is_ok());
    }

    #[test]
    fn test_validate_commit_readiness_rejects_proposed() {
        assert!(StateMachine::validate_commit_readiness(LifecycleStatus::Proposed).is_err());
    }

    #[test]
    fn test_transition_with_audit() {
        let (status, before, after) = StateMachine::transition_with_audit(
            LifecycleStatus::Matched,
            LifecycleStatus::Approved,
        )
        .unwrap();
        assert_eq!(status, LifecycleStatus::Approved);
        assert_eq!(before["lifecycle_status"], "Matched");
        assert_eq!(after["lifecycle_status"], "Approved");
    }

    #[test]
    fn test_no_backward_transition_valid_forward() {
        assert!(StateMachine::validate_no_backward_transition(
            LifecycleStatus::Proposed,
            LifecycleStatus::Matched
        )
        .is_ok());
        assert!(StateMachine::validate_no_backward_transition(
            LifecycleStatus::Matched,
            LifecycleStatus::Committed
        )
        .is_ok());
    }

    #[test]
    fn test_no_backward_transition_reject_backward() {
        let res = StateMachine::validate_no_backward_transition(
            LifecycleStatus::Committed,
            LifecycleStatus::Proposed,
        );
        assert!(matches!(
            res,
            Err(StateMachineError::BackwardTransition { .. })
        ));
    }

    #[test]
    fn test_no_backward_transition_allows_rejection_from_any_state() {
        assert!(StateMachine::validate_no_backward_transition(
            LifecycleStatus::Committed,
            LifecycleStatus::Rejected
        )
        .is_ok());
        assert!(StateMachine::validate_no_backward_transition(
            LifecycleStatus::Proposed,
            LifecycleStatus::Rejected
        )
        .is_ok());
    }

    #[test]
    fn test_project_event_rejects_non_committed() {
        let act_id = uuid::Uuid::new_v4();
        let project_id = uuid::Uuid::new_v4();
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
            updated_at: chrono::Utc::now(),
        };

        let event = ActualEvent {
            id: uuid::Uuid::new_v4(),
            project_id,
            activity_id: act_id,
            observation_id: None,
            match_proposal_id: None,
            event_type: EventType::Finish,
            actual_date: chrono::NaiveDate::from_ymd_opt(2026, 8, 28).unwrap(),
            actual_progress_pct: Some(100.0),
            actual_quantity: None,
            delay_reason: None,
            delay_days: None,
            lifecycle_status: LifecycleStatus::Proposed, // not committed
            verification_status: VerificationStatus::Unverified,
            idempotency_key: None,
            created_by: None,
            created_at: chrono::Utc::now(),
        };

        let planned_finish = chrono::NaiveDate::from_ymd_opt(2026, 8, 30).unwrap();
        let res = StateMachine::project_event(&mut state, &event, planned_finish);
        assert!(matches!(
            res,
            Err(StateMachineError::EventNotCommitted(
                LifecycleStatus::Proposed
            ))
        ));
        // State should remain unchanged
        assert_eq!(state.execution_status, ExecutionStatus::NotStarted);
    }
}
