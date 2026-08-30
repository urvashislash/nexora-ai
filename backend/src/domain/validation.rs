use chrono::{Local, NaiveDate};
use thiserror::Error;
use uuid::Uuid;

use super::models::{
    Activity, ActivityCurrentState, ActivityDependency, DependencyType, ExecutionStatus,
};


#[allow(dead_code)]
#[derive(Debug, Error, PartialEq)]
pub enum ValidationError {
    #[error("Finish date {finish} cannot be before start date {start}")]
    FinishBeforeStart { start: NaiveDate, finish: NaiveDate },

    #[error("Event date {event_date} is in the future beyond acceptable tolerance")]
    FutureDateNotAllowed {
        event_date: NaiveDate,
        max_allowed: NaiveDate,
    },

    #[error("Progress percentage {progress}% is out of bounds (must be 0.0 to 100.0)")]
    InvalidProgressPercentage { progress: f64 },

    #[error("Predecessor dependency violation: Activity '{predecessor_code}' ({predecessor_id}) must be finished before '{successor_code}' can start")]
    PredecessorNotFinished {
        predecessor_id: Uuid,
        predecessor_code: String,
        successor_code: String,
    },

    #[error("Duplicate event detected with idempotency key '{idempotency_key}'")]
    DuplicateEventKey { idempotency_key: String },

    #[error("Cannot complete activity without actual start date")]
    FinishWithoutStart,

    #[error("Quantity {quantity} is negative and not allowed")]
    NegativeQuantity { quantity: f64 },

    #[error("SS dependency violation: Predecessor '{predecessor_code}' ({predecessor_id}) must have started before '{successor_code}' can start")]
    PredecessorNotStarted {
        predecessor_id: Uuid,
        predecessor_code: String,
        successor_code: String,
    },
}

pub struct ValidationEngine;

#[allow(dead_code)]
impl ValidationEngine {
    /// Validates date sequence: finish date must not precede start date
    pub fn validate_date_sequence(
        start: Option<NaiveDate>,
        finish: Option<NaiveDate>,
    ) -> Result<(), ValidationError> {
        if let (Some(s), Some(f)) = (start, finish) {
            if f < s {
                return Err(ValidationError::FinishBeforeStart {
                    start: s,
                    finish: f,
                });
            }
        }
        Ok(())
    }

    /// Validates that an event date is not in the distant future
    pub fn validate_event_date(event_date: NaiveDate) -> Result<(), ValidationError> {
        let today = Local::now().date_naive();
        let max_allowed = today + chrono::Duration::days(1); // 1-day tolerance for timezones
        if event_date > max_allowed {
            return Err(ValidationError::FutureDateNotAllowed {
                event_date,
                max_allowed,
            });
        }
        Ok(())
    }

    /// Validates progress percentage range 0.0..=100.0
    pub fn validate_progress(progress_pct: Option<f64>) -> Result<(), ValidationError> {
        if let Some(p) = progress_pct {
            if !(0.0..=100.0).contains(&p) {
                return Err(ValidationError::InvalidProgressPercentage { progress: p });
            }
        }
        Ok(())
    }

    /// Validates dependency predecessor requirements (e.g. Finish-to-Start)
    pub fn validate_dependencies(
        successor: &Activity,
        dependencies: &[ActivityDependency],
        predecessor_states: &[(Activity, ActivityCurrentState)],
    ) -> Result<(), ValidationError> {
        for dep in dependencies {
            if dep.successor_id == successor.id && dep.dependency_type == DependencyType::Fs {
                if let Some((pred_act, pred_state)) = predecessor_states
                    .iter()
                    .find(|(a, _)| a.id == dep.predecessor_id)
                {
                    if pred_state.execution_status != ExecutionStatus::Completed
                        && pred_state.current_progress_pct < 100.0
                    {
                        return Err(ValidationError::PredecessorNotFinished {
                            predecessor_id: pred_act.id,
                            predecessor_code: pred_act.code.clone(),
                            successor_code: successor.code.clone(),
                        });
                    }
                }
            }
        }
        Ok(())
    }

    /// Validates that an idempotency key is unique and not already present in existing events
    pub fn validate_idempotency_key(
        proposed_key: Option<&str>,
        existing_keys: &[Option<String>],
    ) -> Result<(), ValidationError> {
        if let Some(key) = proposed_key {
            for existing in existing_keys {
                if let Some(e) = existing {
                    if e == key {
                        return Err(ValidationError::DuplicateEventKey {
                            idempotency_key: key.to_string(),
                        });
                    }
                }
            }
        }
        Ok(())
    }

    /// Validates that a Finish event is not created on an activity without an actual start date
    pub fn validate_finish_without_start(
        current_state: &ActivityCurrentState,
    ) -> Result<(), ValidationError> {
        if current_state.actual_start_date.is_none() {
            return Err(ValidationError::FinishWithoutStart);
        }
        Ok(())
    }

    /// Validates that a quantity is not negative
    pub fn validate_quantity_bounds(quantity: Option<f64>) -> Result<(), ValidationError> {
        if let Some(q) = quantity {
            if q < 0.0 {
                return Err(ValidationError::NegativeQuantity { quantity: q });
            }
        }
        Ok(())
    }

    /// Validates Start-to-Start (SS) dependency: successor cannot start before predecessor starts
    pub fn validate_ss_dependency(
        successor: &Activity,
        dependencies: &[ActivityDependency],
        predecessor_states: &[(Activity, ActivityCurrentState)],
    ) -> Result<(), ValidationError> {
        for dep in dependencies {
            if dep.successor_id == successor.id && dep.dependency_type == DependencyType::Ss {
                if let Some((pred_act, pred_state)) = predecessor_states
                    .iter()
                    .find(|(a, _)| a.id == dep.predecessor_id)
                {
                    if pred_state.actual_start_date.is_none() {
                        return Err(ValidationError::PredecessorNotStarted {
                            predecessor_id: pred_act.id,
                            predecessor_code: pred_act.code.clone(),
                            successor_code: successor.code.clone(),
                        });
                    }
                }
            }
        }
        Ok(())
    }

    /// Validates Finish-to-Finish (FF) dependency: successor cannot finish before predecessor finishes
    pub fn validate_ff_dependency(
        successor: &Activity,
        dependencies: &[ActivityDependency],
        predecessor_states: &[(Activity, ActivityCurrentState)],
    ) -> Result<(), ValidationError> {
        for dep in dependencies {
            if dep.successor_id == successor.id && dep.dependency_type == DependencyType::Ff {
                if let Some((pred_act, pred_state)) = predecessor_states
                    .iter()
                    .find(|(a, _)| a.id == dep.predecessor_id)
                {
                    if pred_state.actual_finish_date.is_none() {
                        return Err(ValidationError::PredecessorNotFinished {
                            predecessor_id: pred_act.id,
                            predecessor_code: pred_act.code.clone(),
                            successor_code: successor.code.clone(),
                        });
                    }
                }
            }
        }
        Ok(())
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_date_sequence() {
        let start = NaiveDate::from_ymd_opt(2026, 8, 10);
        let finish = NaiveDate::from_ymd_opt(2026, 8, 20);
        assert!(ValidationEngine::validate_date_sequence(start, finish).is_ok());
    }

    #[test]
    fn test_invalid_date_sequence_finish_before_start() {
        let start = NaiveDate::from_ymd_opt(2026, 8, 20);
        let finish = NaiveDate::from_ymd_opt(2026, 8, 10);
        let res = ValidationEngine::validate_date_sequence(start, finish);
        assert!(matches!(
            res,
            Err(ValidationError::FinishBeforeStart { .. })
        ));
    }

    #[test]
    fn test_progress_bounds() {
        assert!(ValidationEngine::validate_progress(Some(50.0)).is_ok());
        assert!(ValidationEngine::validate_progress(Some(0.0)).is_ok());
        assert!(ValidationEngine::validate_progress(Some(100.0)).is_ok());
        assert!(ValidationEngine::validate_progress(Some(-5.0)).is_err());
        assert!(ValidationEngine::validate_progress(Some(105.0)).is_err());
    }

    #[test]
    fn test_idempotency_key_validation() {
        let existing = vec![Some("key-1".to_string())];
        assert!(ValidationEngine::validate_idempotency_key(Some("key-2"), &existing).is_ok());
        assert!(ValidationEngine::validate_idempotency_key(Some("key-1"), &existing).is_err());
        assert!(ValidationEngine::validate_idempotency_key(None, &existing).is_ok());
    }
}
