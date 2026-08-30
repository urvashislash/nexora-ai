import io
from datetime import date
from pathlib import Path
from uuid import uuid4

import openpyxl
import pytest

from app.models.schemas import (
    DisciplineEnum,
    EventTypeEnum,
    MatchDecisionEnum,
    NormalizedObservation,
    ScheduleActivity,
)
from app.services.evaluation import evaluate_matching_dataset, recommend_thresholds
from app.services.extractor import DocumentExtractor
from app.services.matching_policy import MatchingThresholds
from app.services.media import ExtractedMediaText
from app.services.normalizer import (
    normalize_discipline,
    normalize_equipment_tag,
    normalize_quantity_value,
    normalize_unit_name,
    parse_date_value,
)


def test_image_ocr_flows_into_observations(monkeypatch):
    monkeypatch.setattr(
        "app.services.extractor.ocr_image_bytes",
        lambda _content: ExtractedMediaText(
            "PT-101 calibration completed in Area 100.",
            0.83,
            {"engine": "test-ocr"},
        ),
    )
    observations = DocumentExtractor.extract_from_image_bytes(b"image", uuid4())
    assert len(observations) == 1
    assert observations[0].equipment_tag == "PT-101"
    assert observations[0].extraction_confidence == 0.83
    assert observations[0].metadata["extraction_method"] == "ocr"


def test_voice_asr_flows_into_observations(monkeypatch):
    monkeypatch.setattr(
        "app.services.extractor.transcribe_audio_bytes",
        lambda _content, filename: ExtractedMediaText(
            "Cable traying started in substation 4.",
            0.79,
            {"engine": "test-asr", "filename": filename},
        ),
    )
    observations = DocumentExtractor.extract_from_audio_bytes(b"audio", uuid4(), filename="note.wav")
    assert len(observations) == 1
    assert observations[0].extraction_confidence == 0.79
    assert observations[0].metadata["extraction_method"] == "asr"


def test_csv_tabular_fields_are_normalized():
    content = (
        b"Activity Code,Work Description,Physical Progress,Trade,Actual Qty,UOM,Tag No,Report Date\n"
        b"PIP-2400,spool erection on rack B,0.75,pipe,200,inch dia,RACK-B,20-Aug-2026\n"
    )
    observations = DocumentExtractor.extract_from_excel_bytes(content, uuid4(), filename="daily.csv")
    assert len(observations) == 1
    assert observations[0].reported_progress == 75.0
    assert observations[0].unit_of_measure == "Inch-Dia"
    assert observations[0].observed_at is not None and observations[0].observed_at.date() == date(2026, 8, 20)


def test_schedule_spreadsheet_import_and_row_validation():
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(["Activity Code", "Activity Name", "Discipline", "Planned Start", "Planned Finish", "Equipment Tag"])
    sheet.append(["ELE-3100", "Cable Tray Installation", "Elec", "20-Aug-2026", "30-Aug-2026", "TRAY 100"])
    sheet.append(["BAD-1", "Invalid dates", "Civil", "30-Aug-2026", "20-Aug-2026", ""])
    buffer = io.BytesIO()
    workbook.save(buffer)

    result = DocumentExtractor.extract_schedule_from_tabular_bytes(buffer.getvalue(), uuid4(), filename="schedule.xlsx")
    assert result.rows_processed == 2
    assert len(result.activities) == 1
    assert result.activities[0].code == "ELE-3100"
    assert result.activities[0].equipment_tag == "TRAY-100"
    assert len(result.issues) == 1


def test_normalization_helpers_cover_field_formats():
    assert normalize_discipline("E&I") == "ELECTRICAL"
    assert normalize_equipment_tag("line p101") == "P-101"
    assert normalize_unit_name("cubic metres") == "Cu.M"
    assert normalize_quantity_value("1,250.5 installed") == 1250.5
    assert parse_date_value("Data date: 20.08.26") == date(2026, 8, 20)


def test_uncertain_high_score_is_never_auto_committed():
    dataset = Path(__file__).parent / "fixtures" / "realistic_matching_dataset.json"
    result = evaluate_matching_dataset(dataset)
    assert result.top1_accuracy == 1.0
    assert result.auto_link_precision == 1.0
    assert result.unsafe_auto_links == 0
    assert result.review_required >= 1
    assert result.rejected == 2

    recommended = recommend_thresholds(result.records)
    assert recommended == {
        "high_confidence": 0.85,
        "review": 0.60,
        "rejection": 0.40,
        "min_auto_link_gap": 0.08,
    }


def test_low_extraction_confidence_forces_review(realistic_activity_and_observation):
    activity, observation = realistic_activity_and_observation
    observation.extraction_confidence = 0.40
    proposal = __import__("app.services.matcher", fromlist=["HybridMatcher"]).HybridMatcher.match_observation(
        observation, [activity]
    )
    assert proposal.decision == MatchDecisionEnum.REVIEW_REQUIRED
    assert proposal.auto_link_eligible is False


def test_rejection_boundary_returns_no_top_match(realistic_activity_and_observation):
    activity, observation = realistic_activity_and_observation
    observation.raw_text = "Canteen lunch delivery log"
    observation.normalized_text = observation.raw_text
    observation.discipline = None
    observation.equipment_tag = None
    strict = MatchingThresholds(
        high_confidence=0.85,
        review=0.60,
        rejection=0.50,
        min_auto_link_gap=0.08,
        min_auto_lexical=0.55,
        min_extraction_confidence=0.70,
        version="test",
    )
    proposal = __import__("app.services.matcher", fromlist=["HybridMatcher"]).HybridMatcher.match_observation(
        observation, [activity], thresholds=strict
    )
    assert proposal.decision == MatchDecisionEnum.REJECTED
    assert proposal.top_match is None


@pytest.fixture
def realistic_activity_and_observation():
    project_id = uuid4()
    activity = ScheduleActivity(
        id=uuid4(),
        project_id=project_id,
        code="PIP-2401",
        name="Hydrostatic Testing - Line P-101",
        description="Pressure test crude feed header",
        discipline=DisciplineEnum.PIPING,
        equipment_tag="P-101",
        planned_start_date=date(2026, 8, 1),
        planned_finish_date=date(2026, 9, 30),
    )
    observation = NormalizedObservation(
        project_id=project_id,
        raw_text="PIP-2401 hydro test P-101 completed",
        normalized_text="PIP-2401 Hydrostatic Testing P-101 completed",
        discipline=DisciplineEnum.PIPING,
        equipment_tag="P-101",
        event_type=EventTypeEnum.FINISH,
        extraction_confidence=0.95,
    )
    return activity, observation
