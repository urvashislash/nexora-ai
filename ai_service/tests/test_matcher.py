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


# =============================================================================
# Additional Comprehensive Hybrid Matcher Tests
# =============================================================================

class TestHybridMatcherScenarios:
    """Tests covering various matching algorithms and boundary conditions."""

    @pytest.fixture
    def sample_schedule(self):
        project_id = uuid4()
        return [
            ScheduleActivity(
                id=uuid4(),
                project_id=project_id,
                code="PIP-2400",
                name="Spool Erection - Pipe Rack B",
                description="Erection and bolt-up of prefabricated spools",
                discipline=DisciplineEnum.PIPING,
                location="Pipe Rack B",
                zone="Zone 2",
                equipment_tag="RACK-B",
                planned_start_date=date(2026, 8, 10),
                planned_finish_date=date(2026, 8, 25),
            ),
            ScheduleActivity(
                id=uuid4(),
                project_id=project_id,
                code="CIV-1100",
                name="Rebar Tying - Compressor Foundation",
                description="Rebar binding for foundation C-101",
                discipline=DisciplineEnum.CIVIL,
                location="Compressor House",
                zone="Zone 1",
                equipment_tag="FND-C-101",
                planned_start_date=date(2026, 8, 15),
                planned_finish_date=date(2026, 8, 24),
            ),
            ScheduleActivity(
                id=uuid4(),
                project_id=project_id,
                code="ELE-3100",
                name="Cable Tray Installation - Area 100",
                description="Perforated cable tray routing",
                discipline=DisciplineEnum.ELECTRICAL,
                location="CDU Area 100",
                zone="Zone 1",
                equipment_tag="TRAY-100",
                planned_start_date=date(2026, 8, 20),
                planned_finish_date=date(2026, 8, 30),
            ),
            ScheduleActivity(
                id=uuid4(),
                project_id=project_id,
                code="INS-4100",
                name="Transmitter Calibration - PT-101",
                description="Pressure transmitter hookup and loop test",
                discipline=DisciplineEnum.INSTRUMENTATION,
                location="CDU Area 100",
                zone="Zone 1",
                equipment_tag="PT-101",
                planned_start_date=date(2026, 8, 22),
                planned_finish_date=date(2026, 8, 28),
            ),
        ]

    def test_exact_code_match_boost(self, sample_schedule):
        project_id = sample_schedule[0].project_id
        obs = NormalizedObservation(
            project_id=project_id,
            raw_text="PIP-2400 spool erection completed",
            normalized_text="PIP-2400 Spool Erection and Alignment completed",
            discipline=DisciplineEnum.PIPING,
            event_type=EventTypeEnum.FINISH,
        )
        proposal = HybridMatcher.match_observation(obs, sample_schedule)
        assert proposal.top_match is not None
        assert proposal.top_match.activity_code == "PIP-2400"
        assert proposal.top_match.confidence_score >= 0.85
        assert proposal.top_match.match_tier in (MatchTierEnum.HIGH, MatchTierEnum.MEDIUM)

    def test_equipment_tag_matching(self, sample_schedule):
        project_id = sample_schedule[0].project_id
        obs = NormalizedObservation(
            project_id=project_id,
            raw_text="Calibrated PT-101 today",
            normalized_text="Calibrated Transmitter PT-101 today",
            discipline=DisciplineEnum.INSTRUMENTATION,
            equipment_tag="PT-101",
            event_type=EventTypeEnum.FINISH,
        )
        proposal = HybridMatcher.match_observation(obs, sample_schedule)
        assert proposal.top_match is not None
        assert proposal.top_match.activity_code == "INS-4100"
        assert proposal.top_match.match_tier == MatchTierEnum.HIGH

    def test_location_and_discipline_boost(self, sample_schedule):
        project_id = sample_schedule[0].project_id
        obs = NormalizedObservation(
            project_id=project_id,
            raw_text="Rebar binding at Compressor House",
            normalized_text="Rebar Tying and Shuttering at Compressor House",
            discipline=DisciplineEnum.CIVIL,
            location="Compressor House",
            event_type=EventTypeEnum.PROGRESS,
        )
        proposal = HybridMatcher.match_observation(obs, sample_schedule)
        assert proposal.top_match is not None
        assert proposal.top_match.activity_code == "CIV-1100"

    def test_empty_activity_list(self):
        project_id = uuid4()
        obs = NormalizedObservation(
            project_id=project_id,
            raw_text="Any text",
            normalized_text="Any text",
        )
        proposal = HybridMatcher.match_observation(obs, [])
        assert proposal.candidates == []
        assert proposal.top_match is None
        assert proposal.auto_link_eligible is False

    def test_all_candidates_ranked_descending(self, sample_schedule):
        project_id = sample_schedule[0].project_id
        obs = NormalizedObservation(
            project_id=project_id,
            raw_text="Cable tray work",
            normalized_text="Cable Tray Installation work",
            discipline=DisciplineEnum.ELECTRICAL,
        )
        proposal = HybridMatcher.match_observation(obs, sample_schedule)
        assert len(proposal.candidates) > 0
        scores = [c.confidence_score for c in proposal.candidates]
        assert scores == sorted(scores, reverse=True)

    def test_candidate_rank_indices(self, sample_schedule):
        project_id = sample_schedule[0].project_id
        obs = NormalizedObservation(
            project_id=project_id,
            raw_text="General work",
            normalized_text="General work",
        )
        proposal = HybridMatcher.match_observation(obs, sample_schedule)
        for i, candidate in enumerate(proposal.candidates):
            assert candidate.candidate_rank == i + 1

    def test_unmatched_when_completely_irrelevant(self, sample_schedule):
        project_id = sample_schedule[0].project_id
        obs = NormalizedObservation(
            project_id=project_id,
            raw_text="Catering service delivered 200 lunch packets to camp 3",
            normalized_text="Catering service delivered 200 lunch packets to camp 3",
            discipline=DisciplineEnum.GENERAL,
        )
        proposal = HybridMatcher.match_observation(obs, sample_schedule)
        if proposal.top_match:
            assert proposal.top_match.confidence_score < 0.65
            assert proposal.auto_link_eligible is False
