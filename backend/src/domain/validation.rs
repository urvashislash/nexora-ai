use chrono::{Local, NaiveDate};
use std::collections::{HashMap, HashSet};
use thiserror::Error;
use uuid::Uuid;

use super::models::{
    Activity, ActivityCurrentState, ActivityDependency, DependencyType, Discipline, ExecutionStatus,
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

    #[error("Monotonic progress violation: Reported progress {new_progress}% is lower than verified current progress {current_progress}% without planner signed override")]
    MonotonicProgressViolation {
        current_progress: f64,
        new_progress: f64,
    },

    #[error("P6 XML validation failed: Activity code '{code}' is invalid or duplicate")]
    InvalidP6ActivityCode { code: String },

    #[error("P6 XML validation failed: Dependency links unknown activity '{missing_id}'")]
    P6UnknownDependencyEndpoint { missing_id: Uuid },

    #[error("P6 XML validation failed: Schedule dependency network contains circular loop")]
    P6CyclicDependencyNetwork,
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

    /// Validates monotonic progress invariant unless explicitly overridden by planner
    pub fn validate_monotonic_progress(
        current_progress: f64,
        new_progress: f64,
        has_planner_override: bool,
    ) -> Result<(), ValidationError> {
        if new_progress < current_progress && !has_planner_override {
            return Err(ValidationError::MonotonicProgressViolation {
                current_progress,
                new_progress,
            });
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
            for e in existing_keys.iter().flatten() {
                if e == key {
                    return Err(ValidationError::DuplicateEventKey {
                        idempotency_key: key.to_string(),
                    });
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

    /// Validates imported Primavera P6 activities: unique non-empty codes, date boundaries, positive durations
    pub fn validate_p6_baseline_activities(activities: &[Activity]) -> Result<(), ValidationError> {
        let mut seen_codes = HashSet::new();

        for act in activities {
            let code = act.code.trim();
            if code.is_empty() || !seen_codes.insert(code.to_string()) {
                return Err(ValidationError::InvalidP6ActivityCode {
                    code: act.code.clone(),
                });
            }

            Self::validate_date_sequence(
                Some(act.planned_start_date),
                Some(act.planned_finish_date),
            )?;
            Self::validate_quantity_bounds(act.planned_quantity)?;
        }

        Ok(())
    }

    /// Validates Primavera P6 schedule dependency graph: ensures endpoints exist and detects cycles
    pub fn validate_p6_schedule_network(
        activities: &[Activity],
        dependencies: &[ActivityDependency],
    ) -> Result<(), ValidationError> {
        let activity_ids: HashSet<Uuid> = activities.iter().map(|a| a.id).collect();

        // Check that all dependency endpoints exist
        for dep in dependencies {
            if !activity_ids.contains(&dep.predecessor_id) {
                return Err(ValidationError::P6UnknownDependencyEndpoint {
                    missing_id: dep.predecessor_id,
                });
            }
            if !activity_ids.contains(&dep.successor_id) {
                return Err(ValidationError::P6UnknownDependencyEndpoint {
                    missing_id: dep.successor_id,
                });
            }
        }

        // Build adjacency graph for cycle detection (DFS)
        let mut adj: HashMap<Uuid, Vec<Uuid>> = HashMap::new();
        for dep in dependencies {
            adj.entry(dep.predecessor_id)
                .or_default()
                .push(dep.successor_id);
        }

        let mut visited = HashSet::new();
        let mut rec_stack = HashSet::new();

        fn has_cycle(
            node: Uuid,
            adj: &HashMap<Uuid, Vec<Uuid>>,
            visited: &mut HashSet<Uuid>,
            rec_stack: &mut HashSet<Uuid>,
        ) -> bool {
            visited.insert(node);
            rec_stack.insert(node);

            if let Some(neighbors) = adj.get(&node) {
                for &neighbor in neighbors {
                    if !visited.contains(&neighbor) {
                        if has_cycle(neighbor, adj, visited, rec_stack) {
                            return true;
                        }
                    } else if rec_stack.contains(&neighbor) {
                        return true;
                    }
                }
            }

            rec_stack.remove(&node);
            false
        }

        for &id in &activity_ids {
            if !visited.contains(&id) && has_cycle(id, &adj, &mut visited, &mut rec_stack) {
                return Err(ValidationError::P6CyclicDependencyNetwork);
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

    #[test]
    fn test_monotonic_progress_validation() {
        assert!(ValidationEngine::validate_monotonic_progress(50.0, 60.0, false).is_ok());
        assert!(ValidationEngine::validate_monotonic_progress(50.0, 50.0, false).is_ok());
        assert!(ValidationEngine::validate_monotonic_progress(50.0, 40.0, false).is_err());
        assert!(ValidationEngine::validate_monotonic_progress(50.0, 40.0, true).is_ok());
    }

    #[test]
    fn test_p6_baseline_activities_validation() {
        let project_id = Uuid::new_v4();
        let version_id = Uuid::new_v4();
        let wbs_id = Uuid::new_v4();

        let act1 = Activity {
            id: Uuid::new_v4(),
            project_id,
            schedule_version_id: version_id,
            wbs_id,
            code: "CIV-1001".to_string(),
            name: "Excavation".to_string(),
            description: None,
            discipline: Discipline::Civil,
            planned_start_date: NaiveDate::from_ymd_opt(2026, 9, 1).unwrap(),
            planned_finish_date: NaiveDate::from_ymd_opt(2026, 9, 10).unwrap(),
            planned_duration_days: 10,
            planned_quantity: Some(100.0),
            unit_of_measure: Some("m3".to_string()),
            location: None,
            zone: None,
            equipment_tag: None,
            critical_path: false,
            weightage: 1.0,
        };

        let act2 = Activity {
            id: Uuid::new_v4(),
            project_id,
            schedule_version_id: version_id,
            wbs_id,
            code: "CIV-1002".to_string(),
            name: "Piling".to_string(),
            description: None,
            discipline: Discipline::Civil,
            planned_start_date: NaiveDate::from_ymd_opt(2026, 9, 11).unwrap(),
            planned_finish_date: NaiveDate::from_ymd_opt(2026, 9, 20).unwrap(),
            planned_duration_days: 10,
            planned_quantity: Some(50.0),
            unit_of_measure: Some("nos".to_string()),
            location: None,
            zone: None,
            equipment_tag: None,
            critical_path: false,
            weightage: 1.0,
        };

        let activities = vec![act1.clone(), act2.clone()];
        assert!(ValidationEngine::validate_p6_baseline_activities(&activities).is_ok());

        // Duplicate code error
        let mut duplicate_act = act2.clone();
        duplicate_act.code = "CIV-1001".to_string();
        assert!(
            ValidationEngine::validate_p6_baseline_activities(&[act1.clone(), duplicate_act])
                .is_err()
        );
    }

    #[test]
    fn test_p6_schedule_network_cycle_detection() {
        let project_id = Uuid::new_v4();
        let version_id = Uuid::new_v4();
        let wbs_id = Uuid::new_v4();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        let id3 = Uuid::new_v4();

        let make_act = |id, code: &str| Activity {
            id,
            project_id,
            schedule_version_id: version_id,
            wbs_id,
            code: code.to_string(),
            name: code.to_string(),
            description: None,
            discipline: Discipline::Civil,
            planned_start_date: NaiveDate::from_ymd_opt(2026, 9, 1).unwrap(),
            planned_finish_date: NaiveDate::from_ymd_opt(2026, 9, 10).unwrap(),
            planned_duration_days: 10,
            planned_quantity: None,
            unit_of_measure: None,
            location: None,
            zone: None,
            equipment_tag: None,
            critical_path: false,
            weightage: 1.0,
        };

        let activities = vec![
            make_act(id1, "A1"),
            make_act(id2, "A2"),
            make_act(id3, "A3"),
        ];

        // Valid acyclic dependencies: A1 -> A2 -> A3
        let valid_deps = vec![
            ActivityDependency {
                id: Uuid::new_v4(),
                schedule_version_id: version_id,
                predecessor_id: id1,
                successor_id: id2,
                dependency_type: DependencyType::Fs,
                lag_days: 0,
            },
            ActivityDependency {
                id: Uuid::new_v4(),
                schedule_version_id: version_id,
                predecessor_id: id2,
                successor_id: id3,
                dependency_type: DependencyType::Fs,
                lag_days: 0,
            },
        ];
        assert!(ValidationEngine::validate_p6_schedule_network(&activities, &valid_deps).is_ok());

        // Cyclic dependencies: A1 -> A2 -> A3 -> A1
        let mut cyclic_deps = valid_deps.clone();
        cyclic_deps.push(ActivityDependency {
            id: Uuid::new_v4(),
            schedule_version_id: version_id,
            predecessor_id: id3,
            successor_id: id1,
            dependency_type: DependencyType::Fs,
            lag_days: 0,
        });

        assert_eq!(
            ValidationEngine::validate_p6_schedule_network(&activities, &cyclic_deps),
            Err(ValidationError::P6CyclicDependencyNetwork)
        );
    }
}
