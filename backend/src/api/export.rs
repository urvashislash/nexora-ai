use axum::{
    extract::{Path, State},
    response::IntoResponse,
};
use chrono::Utc;
use uuid::Uuid;

use crate::domain::models::*;

use super::state::AppState;

// =============================================================================
// P6 XML Export
// =============================================================================

pub async fn export_schedule_p6(
    State(state): State<AppState>,
    Path(project_id): Path<Uuid>,
) -> impl IntoResponse {
    let acts = state.activities.read().await;
    let states = state.activity_states.read().await;
    let projects = state.projects.read().await;

    let project = projects.iter().find(|p| p.id == project_id);
    let project_code = project.map(|p| p.code.as_str()).unwrap_or("PRD-HYD-PKG04");
    let project_name = project
        .map(|p| p.name.as_str())
        .unwrap_or("Paradip-Hyderabad Refinery Expansion - Package 04");

    let now_str = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let mut xml = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<APM:Project xmlns:APM=\"http://xmlns.oracle.com/Primavera/P6/V24/APM\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\n");
    xml.push_str("  <APM:APMHeader>\n");
    xml.push_str(&format!(
        "    <APM:CreationDate>{}</APM:CreationDate>\n",
        now_str
    ));
    xml.push_str("    <APM:ExportType>PROJECT</APM:ExportType>\n");
    xml.push_str("    <APM:SchemaVersion>24.12.0</APM:SchemaVersion>\n");
    xml.push_str("  </APM:APMHeader>\n");
    xml.push_str(&format!(
        "  <APM:ProjectObjectId>{}</APM:ProjectObjectId>\n",
        project_code
    ));
    xml.push_str(&format!("  <APM:Id>{}</APM:Id>\n", project_code));
    xml.push_str(&format!("  <APM:Name>{}</APM:Name>\n", project_name));
    xml.push_str("  <APM:Activities>\n");

    for a in acts.iter().filter(|a| a.project_id == project_id) {
        let st = states.iter().find(|s| s.activity_id == a.id);
        let progress = st.map(|s| s.current_progress_pct).unwrap_or(0.0);
        let status_str = match st
            .map(|s| s.execution_status)
            .unwrap_or(ExecutionStatus::NotStarted)
        {
            ExecutionStatus::NotStarted => "Not Started",
            ExecutionStatus::InProgress => "In Progress",
            ExecutionStatus::Completed => "Completed",
            ExecutionStatus::Delayed => "In Progress",
            ExecutionStatus::Blocked => "In Progress",
        };
        xml.push_str("    <APM:Activity>\n");
        xml.push_str(&format!("      <APM:ObjectId>{}</APM:ObjectId>\n", a.id));
        xml.push_str(&format!("      <APM:Id>{}</APM:Id>\n", a.code));
        xml.push_str(&format!("      <APM:Name>{}</APM:Name>\n", a.name));
        xml.push_str(&format!(
            "      <APM:PlannedStartDate>{}</APM:PlannedStartDate>\n",
            a.planned_start_date
        ));
        xml.push_str(&format!(
            "      <APM:PlannedFinishDate>{}</APM:PlannedFinishDate>\n",
            a.planned_finish_date
        ));
        xml.push_str(&format!(
            "      <APM:PlannedDuration>{}</APM:PlannedDuration>\n",
            a.planned_duration_days
        ));
        xml.push_str(&format!(
            "      <APM:PercentComplete>{:.2}</APM:PercentComplete>\n",
            progress
        ));
        xml.push_str(&format!("      <APM:Status>{}</APM:Status>\n", status_str));
        if let Some(act_start) = st.and_then(|s| s.actual_start_date) {
            xml.push_str(&format!(
                "      <APM:ActualStartDate>{}</APM:ActualStartDate>\n",
                act_start
            ));
        }
        if let Some(act_finish) = st.and_then(|s| s.actual_finish_date) {
            xml.push_str(&format!(
                "      <APM:ActualFinishDate>{}</APM:ActualFinishDate>\n",
                act_finish
            ));
        }
        xml.push_str("    </APM:Activity>\n");
    }

    xml.push_str("  </APM:Activities>\n</APM:Project>");
    (
        [
            ("Content-Type", "application/xml"),
            (
                "Content-Disposition",
                "attachment; filename=\"schedule_p6.xml\"",
            ),
        ],
        xml,
    )
}
