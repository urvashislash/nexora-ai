from datetime import date
from typing import Any
from uuid import UUID

from app.models.schemas import DisciplineEnum, ScheduleActivity

PROJECT_ID = UUID("a0000000-0000-0000-0000-000000000001")

# Deterministic activity IDs
ACT_PIPE_1 = UUID("d0000000-0000-0000-0000-000000000001")
ACT_PIPE_2 = UUID("d0000000-0000-0000-0000-000000000002")
ACT_CIVIL_1 = UUID("d0000000-0000-0000-0000-000000000003")
ACT_CIVIL_2 = UUID("d0000000-0000-0000-0000-000000000004")
ACT_ELEC_1 = UUID("d0000000-0000-0000-0000-000000000005")

GOLDEN_SCHEDULE = [
    ScheduleActivity(
        id=ACT_PIPE_1,
        project_id=PROJECT_ID,
        code="PIP-100",
        name="Hydrotest Main Cooling Line",
        discipline=DisciplineEnum.PIPING,
        planned_start_date=date(2026, 8, 1),
        planned_finish_date=date(2026, 8, 5),
        planned_quantity=100.0,
        unit_of_measure="LM",
        zone="Area A",
    ),
    ScheduleActivity(
        id=ACT_PIPE_2,
        project_id=PROJECT_ID,
        code="PIP-101",
        name="Weld spools for secondary pump",
        discipline=DisciplineEnum.PIPING,
        planned_start_date=date(2026, 8, 6),
        planned_finish_date=date(2026, 8, 10),
        planned_quantity=50.0,
        unit_of_measure="DIA",
        zone="Area B",
        equipment_tag="PMP-002",
    ),
    ScheduleActivity(
        id=ACT_CIVIL_1,
        project_id=PROJECT_ID,
        code="CIV-200",
        name="Pour concrete foundation for pump",
        discipline=DisciplineEnum.CIVIL,
        planned_start_date=date(2026, 8, 1),
        planned_finish_date=date(2026, 8, 3),
        planned_quantity=25.0,
        unit_of_measure="M3",
        equipment_tag="PMP-002",
    ),
    ScheduleActivity(
        id=ACT_CIVIL_2,
        project_id=PROJECT_ID,
        code="CIV-201",
        name="Excavate trench for power cables",
        discipline=DisciplineEnum.CIVIL,
        planned_start_date=date(2026, 7, 28),
        planned_finish_date=date(2026, 7, 30),
        planned_quantity=120.0,
        unit_of_measure="M3",
    ),
    ScheduleActivity(
        id=ACT_ELEC_1,
        project_id=PROJECT_ID,
        code="ELE-300",
        name="Pull power cables in trench",
        discipline=DisciplineEnum.ELECTRICAL,
        planned_start_date=date(2026, 8, 1),
        planned_finish_date=date(2026, 8, 4),
        planned_quantity=500.0,
        unit_of_measure="LM",
    ),
]

GOLDEN_TEST_CASES: list[dict[str, Any]] = [
    # True positives (Exact matches)
    {
        "text": "Completed hydro testing for the main cooling line in Area A today.",
        "discipline": DisciplineEnum.PIPING,
        "expected_activity_id": ACT_PIPE_1,
        "type": "exact_match",
    },
    {
        "text": "Welding spools finished on PMP-002.",
        "discipline": DisciplineEnum.PIPING,
        "expected_activity_id": ACT_PIPE_2,
        "type": "synonym_match",
    },
    {
        "text": "Poured 25 cubic meters of concrete for the PMP-002 foundation.",
        "discipline": DisciplineEnum.CIVIL,
        "expected_activity_id": ACT_CIVIL_1,
        "type": "context_match",
    },
    {
        "text": "Trench excavation is done for the electrical run.",
        "discipline": DisciplineEnum.CIVIL,
        "expected_activity_id": ACT_CIVIL_2,
        "type": "lexical_match",
    },
    {
        "text": "Electricians pulled 500 meters of power cable today.",
        "discipline": DisciplineEnum.ELECTRICAL,
        "expected_activity_id": ACT_ELEC_1,
        "type": "exact_match",
    },
    # Ambiguous or cross-discipline (Should rely on context or discipline filter)
    {
        "text": "Working on PMP-002 foundation.",
        "discipline": DisciplineEnum.CIVIL,
        "expected_activity_id": ACT_CIVIL_1,
        "type": "discipline_filter",
    },
    {
        "text": "Working on PMP-002 welding.",
        "discipline": DisciplineEnum.PIPING,
        "expected_activity_id": ACT_PIPE_2,
        "type": "discipline_filter",
    },
    # True negatives (Should be UNMATCHED or LOW confidence)
    {
        "text": "Safety meeting held at site office.",
        "discipline": DisciplineEnum.HSE,
        "expected_activity_id": None,
        "type": "true_negative",
    },
    {
        "text": "Delivered lunch to the crew in Area B.",
        "discipline": DisciplineEnum.GENERAL,
        "expected_activity_id": None,
        "type": "true_negative",
    },
    {
        "text": "Installed HVAC ducts in the control room.",
        "discipline": DisciplineEnum.MECHANICAL,
        "expected_activity_id": None,
        "type": "out_of_scope",
    },
]
