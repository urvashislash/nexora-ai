from datetime import date
from uuid import uuid4
import pytest

from app.models.schemas import (
    DisciplineEnum,
    EventTypeEnum,
    MatchTierEnum,
    NormalizedObservation,
    ScheduleActivity,
)
from app.services.extractor import DocumentExtractor
from app.services.matcher import HybridMatcher
from app.services.normalizer import default_normalizer


def test_terminology_normalization():
    text = "Piping team completed hydro test on p-101 yesterday."
    normalized = default_normalizer.normalize(text)
    assert "Hydrostatic Testing" in normalized
    assert "Line P-101" in normalized


def test_document_extraction():
    project_id = uuid4()
    sample_text = """
    DAILY CONSTRUCTION REPORT - AREA 101
    1. Spool erection complete on Pipe Rack B Tier 2 (100% finished).
    2. Concrete pour for column footing COL-FTG-100 started, 45 cu.m poured.
    3. Heavy rain delayed civil work by 4 hours.
    """
    observations = DocumentExtractor.extract_from_text(sample_text, project_id)
    assert len(observations) >= 3
    
    # Check first observation
    obs1 = observations[0]
    assert obs1.discipline == DisciplineEnum.PIPING
    assert obs1.event_type == EventTypeEnum.FINISH
    assert obs1.reported_progress == 100.0
    assert "Spool Erection and Alignment" in obs1.normalized_text

    # Check second observation
    obs2 = observations[1]
    assert obs2.discipline == DisciplineEnum.CIVIL
    assert obs2.event_type == EventTypeEnum.START


def test_hybrid_matching_exact_scenario():
    project_id = uuid4()
    act_pip = ScheduleActivity(
        id=uuid4(),
        project_id=project_id,
        code="PIP-2401",
        name="Hydrostatic Testing - Line P-101 (Crude Feed Header)",
        description="Pressure testing of 24 inch crude feed header Line P-101 at 42.5 bar",
        discipline=DisciplineEnum.PIPING,
        location="Pipe Rack B",
        zone="Zone 2",
        equipment_tag="LINE-P-101",
        planned_start_date=date(2026, 8, 26),
        planned_finish_date=date(2026, 8, 28)
    )

    act_civ = ScheduleActivity(
        id=uuid4(),
        project_id=project_id,
        code="CIV-1101",
        name="Concrete Pour - Column Footings Area 100",
        description="M35 grade ready-mix concrete pouring for heavy column footings",
        discipline=DisciplineEnum.CIVIL,
        location="CDU Area 100",
        zone="Zone 1",
        equipment_tag="COL-FTG-100",
        planned_start_date=date(2026, 8, 25),
        planned_finish_date=date(2026, 8, 29)
    )

    # Observation: "P-101 completed"
    obs = NormalizedObservation(
        project_id=project_id,
        raw_text="P-101 completed",
        normalized_text="Line P-101 completed",
        discipline=DisciplineEnum.PIPING,
        equipment_tag="LINE-P-101",
        event_type=EventTypeEnum.FINISH,
        reported_progress=100.0
    )

    proposal = HybridMatcher.match_observation(obs, [act_pip, act_civ])
    
    assert proposal.top_match is not None
    assert proposal.top_match.activity_code == "PIP-2401"
    assert proposal.top_match.confidence_score >= 0.85
    assert proposal.top_match.match_tier in (MatchTierEnum.HIGH, MatchTierEnum.MEDIUM)


def test_excel_extraction():
    """Test extraction from an in-memory Excel file (.xlsx)."""
    import io
    import openpyxl

    project_id = uuid4()

    # Create an in-memory Excel workbook with construction log data
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Daily Log"

    # Header row
    ws.append(["Activity Code", "Description", "Status", "Discipline", "Remarks"])

    # Data rows simulating real EPC daily progress entries
    ws.append(["PIP-2400", "Spool erection on Pipe Rack B Tier 2", "100% Complete", "Piping", "All spools erected"])
    ws.append(["CIV-1100", "Rebar tying for compressor foundation", "In Progress", "Civil", "15 MT tied"])
    ws.append(["CIV-1101", "Concrete pour column footings", "Not Started", "Civil", "Awaiting rebar QC"])

    # Save to bytes
    buf = io.BytesIO()
    wb.save(buf)
    excel_bytes = buf.getvalue()

    # Extract observations
    observations = DocumentExtractor.extract_from_excel_bytes(excel_bytes, project_id)

    assert len(observations) == 3

    # First row: piping complete
    obs1 = observations[0]
    assert obs1.discipline == DisciplineEnum.PIPING
    assert obs1.reported_progress == 100.0

    # Second row: civil in-progress
    obs2 = observations[1]
    assert obs2.discipline == DisciplineEnum.CIVIL

    # Third row: civil not started
    obs3 = observations[2]
    assert obs3.discipline == DisciplineEnum.CIVIL

    # All should have valid normalized text
    for obs in observations:
        assert obs.normalized_text is not None
        assert len(obs.normalized_text) > 0
        assert obs.project_id == project_id

