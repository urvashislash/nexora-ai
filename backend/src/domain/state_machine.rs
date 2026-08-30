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

    /// Guard: verifies that an event's lifecycle status is `Approved` before
    /// allowing transition to `Committed`. Returns error if the event is not
    /// in a committable state.
    pub fn validate_commit_readiness(
        current_status: LifecycleStatus,
    ) -> Result<(), StateMachineError> {
        if current_status == LifecycleStatus::Approved {
            Ok(())
        } else {
            Err(StateMachineError::CannotCommit(current_status))
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

    /// Projects an approved/committed actual event onto the activity's current execution state
    pub fn project_event(
        current_state: &mut ActivityCurrentState,
        event: &ActualEvent,
        planned_finish_date: NaiveDate,
    ) {
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
    }
}

#[cfg(test)]
mod tests {
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
    fn test_validate_commit_readiness() {
        assert!(StateMachine::validate_commit_readiness(LifecycleStatus::Approved).is_ok());
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
}
