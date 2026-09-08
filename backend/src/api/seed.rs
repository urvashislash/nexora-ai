use chrono::{NaiveDate, Utc};
use uuid::Uuid;

use crate::domain::models::*;

/// Generates initial seed data for local development, demos, and testing.
pub fn get_seed_demo_data() -> (Vec<Project>, Vec<Activity>, Vec<ActivityCurrentState>) {
    let project_id = Uuid::parse_str("a0000000-0000-0000-0000-000000000001").unwrap();
    let schedule_version_id = Uuid::parse_str("b0000000-0000-0000-0000-000000000001").unwrap();
    let wbs_id = Uuid::parse_str("c0000000-0000-0000-0000-000000000003").unwrap();

    let demo_project = Project {
        id: project_id,
        code: "PRD-HYD-PKG04".to_string(),
        name: "Paradip-Hyderabad Refinery Expansion - Package 04".to_string(),
        description: Some(
            "EPC Package for Crude Distillation Unit (CDU), Pipe Rack B, and Compressor Station".to_string(),
        ),
        timezone: "Asia/Kolkata".to_string(),
        currency: "INR".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let act1_id = Uuid::parse_str("d0000000-0000-0000-0000-000000000001").unwrap();
    let act2_id = Uuid::parse_str("d0000000-0000-0000-0000-000000000002").unwrap();
    let act3_id = Uuid::parse_str("d0000000-0000-0000-0000-000000000003").unwrap();
    let act4_id = Uuid::parse_str("d0000000-0000-0000-0000-000000000004").unwrap();
    let act5_id = Uuid::parse_str("d0000000-0000-0000-0000-000000000005").unwrap();

    let activities = vec![
        Activity {
            id: act1_id,
            project_id,
            schedule_version_id,
            wbs_id,
            code: "PIP-2400".to_string(),
            name: "Spool Erection and Alignment - Pipe Rack B".to_string(),
            description: Some(
                "Prefabricated carbon steel piping spool erection on Rack B".to_string(),
            ),
            discipline: Discipline::Piping,
            planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 10).unwrap(),
            planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
            planned_duration_days: 15,
            planned_quantity: Some(450.0),
            unit_of_measure: Some("Inch-Dia".to_string()),
            location: Some("Pipe Rack B".to_string()),
            zone: Some("Zone 2".to_string()),
            equipment_tag: Some("RACK-B-CS".to_string()),
            weightage: 1.5,
            critical_path: true,
        },
        Activity {
            id: act2_id,
            project_id,
            schedule_version_id,
            wbs_id,
            code: "PIP-2401".to_string(),
            name: "Hydrostatic Testing - Line P-101 (Crude Feed Header)".to_string(),
            description: Some(
                "Pressure testing of 24 inch crude feed header Line P-101".to_string(),
            ),
            discipline: Discipline::Piping,
            planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 26).unwrap(),
            planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 28).unwrap(),
            planned_duration_days: 3,
            planned_quantity: Some(1.0),
            unit_of_measure: Some("Test-Pack".to_string()),
            location: Some("Pipe Rack B".to_string()),
            zone: Some("Zone 2".to_string()),
            equipment_tag: Some("LINE-P-101".to_string()),
            weightage: 2.0,
            critical_path: true,
        },
        Activity {
            id: act3_id,
            project_id,
            schedule_version_id,
            wbs_id,
            code: "PIP-2402".to_string(),
            name: "Hydrostatic Testing - Line P-102 (Naphtha Return Header)".to_string(),
            description: Some(
                "Pressure testing of 16 inch naphtha return header Line P-102".to_string(),
            ),
            discipline: Discipline::Piping,
            planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 28).unwrap(),
            planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 30).unwrap(),
            planned_duration_days: 3,
            planned_quantity: Some(1.0),
            unit_of_measure: Some("Test-Pack".to_string()),
            location: Some("Pipe Rack B".to_string()),
            zone: Some("Zone 2".to_string()),
            equipment_tag: Some("LINE-P-102".to_string()),
            weightage: 1.8,
            critical_path: false,
        },
        Activity {
            id: act4_id,
            project_id,
            schedule_version_id,
            wbs_id,
            code: "CIV-1100".to_string(),
            name: "Rebar Tying and Shuttering - Compressor Foundation".to_string(),
            description: Some(
                "Reinforcement steel bar cutting, bending and shuttering".to_string(),
            ),
            discipline: Discipline::Civil,
            planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 15).unwrap(),
            planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 24).unwrap(),
            planned_duration_days: 10,
            planned_quantity: Some(35.5),
            unit_of_measure: Some("MT".to_string()),
            location: Some("Compressor House".to_string()),
            zone: Some("Zone 1".to_string()),
            equipment_tag: Some("FND-C-101".to_string()),
            weightage: 1.2,
            critical_path: false,
        },
        Activity {
            id: act5_id,
            project_id,
            schedule_version_id,
            wbs_id,
            code: "CIV-1101".to_string(),
            name: "Concrete Pour - Column Footings Area 100".to_string(),
            description: Some(
                "Ready-mix concrete pouring for heavy column footings".to_string(),
            ),
            discipline: Discipline::Civil,
            planned_start_date: NaiveDate::from_ymd_opt(2026, 8, 25).unwrap(),
            planned_finish_date: NaiveDate::from_ymd_opt(2026, 8, 29).unwrap(),
            planned_duration_days: 5,
            planned_quantity: Some(180.0),
            unit_of_measure: Some("Cu.M".to_string()),
            location: Some("CDU Area 100".to_string()),
            zone: Some("Zone 1".to_string()),
            equipment_tag: Some("COL-FTG-100".to_string()),
            weightage: 1.4,
            critical_path: false,
        },
    ];

    let states = activities
        .iter()
        .map(|a| ActivityCurrentState {
            activity_id: a.id,
            project_id: a.project_id,
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
        })
        .collect();

    (vec![demo_project], activities, states)
}
