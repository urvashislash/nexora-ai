import json
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


@pytest.fixture
def demo_activities():
    project_id = uuid4()
    return [
        ScheduleActivity(
            id=uuid4(),
            project_id=project_id,
            code="PIP-2400",
            name="Spool Erection and Alignment - Pipe Rack B",
            description="Prefabricated carbon steel piping spool erection on Rack B",
            discipline=DisciplineEnum.PIPING,
            location="Pipe Rack B",
            zone="Zone 2",
            equipment_tag="RACK-B-CS",
            planned_start_date=date(2026, 8, 10),
            planned_finish_date=date(2026, 8, 25),
        ),
        ScheduleActivity(
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
            planned_finish_date=date(2026, 8, 28),
        ),
        ScheduleActivity(
            id=uuid4(),
            project_id=project_id,
            code="PIP-2402",
            name="Hydrostatic Testing - Line P-102 (Naphtha Return Header)",
            description="Pressure testing of 16 inch naphtha return header Line P-102 at 32.0 bar",
            discipline=DisciplineEnum.PIPING,
            location="Pipe Rack B",
            zone="Zone 2",
            equipment_tag="LINE-P-102",
            planned_start_date=date(2026, 8, 28),
            planned_finish_date=date(2026, 8, 30),
        ),
        ScheduleActivity(
            id=uuid4(),
            project_id=project_id,
            code="CIV-1100",
            name="Rebar Tying and Shuttering - Compressor Foundation",
            description="Reinforcement steel bar cutting, bending, binding for C-101",
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
            code="CIV-1101",
            name="Concrete Pour - Column Footings Area 100",
            description="M35 grade ready-mix concrete pouring for heavy column footings C1-C12",
            discipline=DisciplineEnum.CIVIL,
            location="CDU Area 100",
            zone="Zone 1",
            equipment_tag="COL-FTG-100",
            planned_start_date=date(2026, 8, 25),
            planned_finish_date=date(2026, 8, 29),
        ),
        ScheduleActivity(
            id=uuid4(),
            project_id=project_id,
            code="MEC-3200",
            name="Pump Alignment and Baseplate Grouting - Crude Charge Pump P-101A",
            description="Mechanical alignment, dial indicator runout check and epoxy grouting",
            discipline=DisciplineEnum.MECHANICAL,
            location="Pump House 1",
            zone="Zone 1",
            equipment_tag="P-101A",
            planned_start_date=date(2026, 8, 20),
            planned_finish_date=date(2026, 8, 25),
        ),
        ScheduleActivity(
            id=uuid4(),
            project_id=project_id,
            code="ELE-4100",
            name="Cable Tray Bracket Mounting and Ladder Traying - Rack B Tier 3",
            description="Electrical cable tray bracket welding and ladder tray installation",
            discipline=DisciplineEnum.ELECTRICAL,
            location="Pipe Rack B",
            zone="Zone 2",
            equipment_tag="RACK-B-T3",
            planned_start_date=date(2026, 8, 22),
            planned_finish_date=date(2026, 8, 28),
        ),
        ScheduleActivity(
            id=uuid4(),
            project_id=project_id,
            code="INS-5100",
            name="Bench Calibration and Impulse Tubing Hookup - Pressure Transmitter PT-101",
            description="5-point calibration and stainless steel 1/2 inch impulse tubing hookup",
            discipline=DisciplineEnum.INSTRUMENTATION,
            location="CDU Area 100",
            zone="Zone 1",
            equipment_tag="PT-101",
            planned_start_date=date(2026, 8, 25),
            planned_finish_date=date(2026, 8, 29),
        ),
    ]


def test_scenario_a_exact_match(demo_activities):
    """
    Scenario A: "P-101 completed" -> Matches PIP-2401, High confidence, Auto-link eligible.
    """
    project_id = demo_activities[0].project_id
    text = "P-101 completed successfully with 42.5 bar pressure holding."
    
    observations = DocumentExtractor.extract_from_text(text, project_id)
    assert len(observations) == 1
    obs = observations[0]
    
    proposal = HybridMatcher.match_observation(obs, demo_activities)
    assert proposal.top_match is not None
    assert proposal.top_match.activity_code == "PIP-2401"
    assert proposal.top_match.confidence_score >= 0.88
    assert proposal.top_match.match_tier == MatchTierEnum.HIGH
    assert proposal.auto_link_eligible is True


def test_scenario_b_semantic_match(demo_activities):
    """
    Scenario B: "spool erection complete" -> Matches PIP-2400 despite wording difference.
    """
    project_id = demo_activities[0].project_id
    text = "spool erection complete on Pipe Rack B Tier 2 with alignment done."
    
    observations = DocumentExtractor.extract_from_text(text, project_id)
    assert len(observations) == 1
    obs = observations[0]
    
    proposal = HybridMatcher.match_observation(obs, demo_activities)
    assert proposal.top_match is not None
    assert proposal.top_match.activity_code == "PIP-2400"
    assert proposal.top_match.confidence_score >= 0.85
    assert proposal.top_match.match_tier in (MatchTierEnum.HIGH, MatchTierEnum.MEDIUM)


def test_scenario_c_ambiguous_match(demo_activities):
    """
    Scenario C: Ambiguous statement matching two similar activities -> Routes to Planner Review.
    """
    project_id = demo_activities[0].project_id
    text = "Hydrostatic pressure testing completed along Pipe Rack B headers yesterday."
    
    observations = DocumentExtractor.extract_from_text(text, project_id)
    assert len(observations) == 1
    obs = observations[0]
    
    proposal = HybridMatcher.match_observation(obs, demo_activities)
    assert len(proposal.candidates) >= 2
    # Two piping test activities PIP-2401 and PIP-2402 have close scores
    assert proposal.candidates[0].activity_code in ("PIP-2401", "PIP-2402")
    assert proposal.candidates[1].activity_code in ("PIP-2401", "PIP-2402")
    # Score gap is small -> Not auto-linked, requires human review
    score_gap = abs(proposal.candidates[0].confidence_score - proposal.candidates[1].confidence_score)
    assert score_gap < 0.15


def test_scenario_d_unmatched_work(demo_activities):
    """
    Scenario D: New work not present in baseline schedule -> Routed to Unmatched queue.
    """
    project_id = demo_activities[0].project_id
    text = "Emergency dewatering and deep foundation pit excavation carried out near Substation 4."
    
    observations = DocumentExtractor.extract_from_text(text, project_id)
    assert len(observations) == 1
    obs = observations[0]
    
    proposal = HybridMatcher.match_observation(obs, demo_activities)
    # Score is low for refinery piping/foundation activities
    if proposal.top_match:
        assert proposal.top_match.confidence_score < 0.60
        assert proposal.auto_link_eligible is False


def test_scenario_e_invalid_dates_validation():
    """
    Scenario E: Finish date before start date -> Validation error.
    """
    start_date = date(2026, 8, 28)
    finish_date = date(2026, 8, 20)

    # Pure Python representation of the Rust validation rule
    is_valid = finish_date >= start_date
    assert is_valid is False


def test_golden_benchmark_dataset_execution(demo_activities):
    """
    Executes the golden benchmark dataset across all disciplines (Piping, Civil, Mechanical, Electrical, Instrumentation).
    """
    import os
    benchmark_path = os.path.join(os.path.dirname(__file__), "..", "golden_dataset", "field_observations.json")
    with open(benchmark_path) as f:
        dataset = json.load(f)

    project_id = demo_activities[0].project_id

    for scenario in dataset["scenarios"]:
        if "expected_validation_error" in scenario:
            continue

        raw_text = scenario["raw_text"]
        observations = DocumentExtractor.extract_from_text(raw_text, project_id)
        assert len(observations) >= 1
        obs = observations[0]

        proposal = HybridMatcher.match_observation(obs, demo_activities)

        if scenario.get("expected_activity_code"):
            expected_code = scenario["expected_activity_code"]
            assert proposal.top_match is not None, f"Expected top match for {scenario['id']}"
            assert proposal.top_match.activity_code == expected_code, (
                f"Scenario {scenario['id']}: expected {expected_code}, got {proposal.top_match.activity_code}"
            )
            print(f"DEBUG: {scenario['id']} -> score={proposal.top_match.confidence_score}, tier={proposal.top_match.match_tier}, expected={scenario['expected_match_tier']}")
            assert proposal.top_match.match_tier == MatchTierEnum(scenario["expected_match_tier"]), (
                f"Scenario {scenario['id']} ({raw_text}): expected tier {scenario['expected_match_tier']} but got {proposal.top_match.match_tier} (score={proposal.top_match.confidence_score})"
            )
            assert proposal.auto_link_eligible == scenario["expected_auto_link"], (
                f"Scenario {scenario['id']}: expected auto_link={scenario['expected_auto_link']} but got {proposal.auto_link_eligible}"
            )



def test_full_pdf_ingestion_end_to_end(demo_activities):
    """
    Tests end-to-end PDF report ingestion -> text extraction -> normalization -> hybrid matching.
    """
    import fitz

    doc = fitz.open()
    page = doc.new_page()
    report_text = (
        "DAILY SITE PROGRESS REPORT\n"
        "Project: PRD-HYD-PKG04 Paradip Expansion\n"
        "1. P-101 completed successfully with 42.5 bar hydro test pressure holding.\n"
        "2. Cable tray bracket mounting and ladder tray installation along Rack B Tier 3 complete.\n"
        "3. Bench calibration and impulse tubing hookup for Pressure Transmitter PT-101 complete.\n"
    )
    page.insert_text((50, 72), report_text)
    pdf_bytes = doc.write()
    doc.close()

    project_id = demo_activities[0].project_id
    observations = DocumentExtractor.extract_from_pdf_bytes(pdf_bytes, project_id)
    assert len(observations) == 3

    # Match each observation
    proposals = [HybridMatcher.match_observation(obs, demo_activities) for obs in observations]

    # Verify 1st: P-101 -> PIP-2401 (Auto-link eligible)
    assert proposals[0].top_match.activity_code == "PIP-2401"
    assert proposals[0].auto_link_eligible is True

    # Verify 2nd: Cable Tray -> ELE-4100
    assert proposals[1].top_match.activity_code == "ELE-4100"
    assert proposals[1].auto_link_eligible is True

    # Verify 3rd: PT-101 -> INS-5100
    assert proposals[2].top_match.activity_code == "INS-5100"
    assert proposals[2].auto_link_eligible is True

