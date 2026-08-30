use chrono::NaiveDate;
use thiserror::Error;

use super::models::{
    ActualEvent, ActivityCurrentState, EventType, ExecutionStatus, LifecycleStatus,
    VerificationStatus,
};

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

impl StateMachine {
    /// Validates and advances lifecycle status
    pub fn transition_lifecycle(
        current: LifecycleStatus,
        target: LifecycleStatus,
    ) -> Result<LifecycleStatus, StateMachineError> {
        let is_valid = match (current, target) {
            (LifecycleStatus::Proposed, LifecycleStatus::Matched) => true,
            (LifecycleStatus::Proposed, LifecycleStatus::ReviewRequired) => true,
            (LifecycleStatus::Proposed, LifecycleStatus::Rejected) => true,
            (LifecycleStatus::Matched, LifecycleStatus::Approved) => true,
            (LifecycleStatus::Matched, LifecycleStatus::ReviewRequired) => true,
            (LifecycleStatus::Matched, LifecycleStatus::Rejected) => true,
            (LifecycleStatus::ReviewRequired, LifecycleStatus::Approved) => true,
            (LifecycleStatus::ReviewRequired, LifecycleStatus::Rejected) => true,
            (LifecycleStatus::Approved, LifecycleStatus::Committed) => true,
            (LifecycleStatus::Approved, LifecycleStatus::Rejected) => true,
            _ => false,
        };

        if is_valid {
            Ok(target)
        } else {
            Err(StateMachineError::InvalidTransition {
                from: current,
                to: target,
            })
        }
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
                    current_state.current_progress_pct = pct.max(current_state.current_progress_pct);
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
    use uuid::Uuid;

    #[test]
    fn test_valid_transitions() {
        assert_eq!(
            StateMachine::transition_lifecycle(LifecycleStatus::Proposed, LifecycleStatus::Matched).unwrap(),
            LifecycleStatus::Matched
        );
        assert_eq!(
            StateMachine::transition_lifecycle(LifecycleStatus::Matched, LifecycleStatus::Approved).unwrap(),
            LifecycleStatus::Approved
        );
        assert_eq!(
            StateMachine::transition_lifecycle(LifecycleStatus::Approved, LifecycleStatus::Committed).unwrap(),
            LifecycleStatus::Committed
        );
    }

    #[test]
    fn test_invalid_transitions() {
        let res = StateMachine::transition_lifecycle(LifecycleStatus::Committed, LifecycleStatus::Proposed);
        assert!(res.is_err());
    }
}
