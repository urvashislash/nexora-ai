"""
Comprehensive tests for Pydantic schemas and model validation.
Tests all model instantiation, field defaults, enum values, and validation rules.
"""
from datetime import date, datetime
from uuid import uuid4, UUID
import pytest
from pydantic import ValidationError

from app.models.schemas import (
    DisciplineEnum,
    EventTypeEnum,
    MatchTierEnum,
    DocumentJobType,
    RawObservation,
    NormalizedObservation,
    ScheduleActivity,
    MatchCandidate,
    MatchProposalPayload,
    ExtractRequest,
    NormalizeRequest,
    EmbedRequest,
    EmbedResponse,
    MatchRequest,
    ProcessDocumentMessage,
)


# =============================================================================
# Enum Tests
# =============================================================================

class TestEnums:
    def test_discipline_values(self):
        assert len(DisciplineEnum) == 7
        assert DisciplineEnum.CIVIL.value == "CIVIL"
        assert DisciplineEnum.PIPING.value == "PIPING"
        assert DisciplineEnum.MECHANICAL.value == "MECHANICAL"
        assert DisciplineEnum.ELECTRICAL.value == "ELECTRICAL"
        assert DisciplineEnum.INSTRUMENTATION.value == "INSTRUMENTATION"
        assert DisciplineEnum.HSE.value == "HSE"
        assert DisciplineEnum.GENERAL.value == "GENERAL"

    def test_event_type_values(self):
        assert len(EventTypeEnum) == 6
        assert EventTypeEnum.START.value == "START"
        assert EventTypeEnum.FINISH.value == "FINISH"
        assert EventTypeEnum.PROGRESS.value == "PROGRESS"
        assert EventTypeEnum.DELAY.value == "DELAY"
        assert EventTypeEnum.BLOCKER.value == "BLOCKER"
        assert EventTypeEnum.INSPECTION.value == "INSPECTION"

    def test_match_tier_values(self):
        assert len(MatchTierEnum) == 4
        assert MatchTierEnum.HIGH.value == "HIGH"
        assert MatchTierEnum.MEDIUM.value == "MEDIUM"
        assert MatchTierEnum.LOW.value == "LOW"
        assert MatchTierEnum.UNMATCHED.value == "UNMATCHED"

    def test_document_job_type_values(self):
        assert len(DocumentJobType) == 7
        assert DocumentJobType.PARSE.value == "PARSE"
        assert DocumentJobType.OCR.value == "OCR"
        assert DocumentJobType.MATCH.value == "MATCH"

    def test_enums_are_string_enums(self):
        assert isinstance(DisciplineEnum.CIVIL, str)
        assert isinstance(EventTypeEnum.START, str)
        assert isinstance(MatchTierEnum.HIGH, str)


# =============================================================================
# RawObservation Tests
# =============================================================================

class TestRawObservation:
    def test_minimal_creation(self):
        obs = RawObservation(raw_text="Test observation")
        assert obs.raw_text == "Test observation"
        assert obs.discipline is None
        assert obs.metadata == {}

    def test_full_creation(self):
        obs = RawObservation(
            raw_text="Spool erection on Rack B",
            discipline=DisciplineEnum.PIPING,
            event_type=EventTypeEnum.FINISH,
            reported_progress=100.0,
            location="Pipe Rack B",
            zone="Zone 2",
            equipment_tag="RACK-B",
            reported_quantity=450.0,
            unit_of_measure="Inch-Dia",
        )
        assert obs.discipline == DisciplineEnum.PIPING
        assert obs.reported_progress == 100.0
        assert obs.unit_of_measure == "Inch-Dia"

    def test_metadata_default(self):
        obs = RawObservation(raw_text="test")
        assert obs.metadata == {}
        assert isinstance(obs.metadata, dict)


# =============================================================================
# NormalizedObservation Tests
# =============================================================================

class TestNormalizedObservation:
    def test_creation_with_required_fields(self):
        pid = uuid4()
        obs = NormalizedObservation(
            raw_text="concrete pour",
            normalized_text="Concrete Pour",
            project_id=pid,
        )
        assert obs.project_id == pid
        assert obs.normalized_text == "Concrete Pour"
        assert isinstance(obs.id, UUID)

    def test_auto_generated_id(self):
        obs1 = NormalizedObservation(raw_text="a", normalized_text="A", project_id=uuid4())
        obs2 = NormalizedObservation(raw_text="b", normalized_text="B", project_id=uuid4())
        assert obs1.id != obs2.id

    def test_extraction_confidence_default(self):
        obs = NormalizedObservation(raw_text="a", normalized_text="A", project_id=uuid4())
        assert obs.extraction_confidence == 1.0

    def test_inherits_raw_observation_fields(self):
        obs = NormalizedObservation(
            raw_text="Spool work",
            normalized_text="Spool Erection",
            project_id=uuid4(),
            discipline=DisciplineEnum.PIPING,
            reported_progress=80.0,
        )
        assert obs.discipline == DisciplineEnum.PIPING
        assert obs.reported_progress == 80.0


# =============================================================================
# ScheduleActivity Tests
# =============================================================================

class TestScheduleActivity:
    def test_creation(self):
        act = ScheduleActivity(
            id=uuid4(),
            project_id=uuid4(),
            code="PIP-2400",
            name="Spool Erection",
            discipline=DisciplineEnum.PIPING,
            planned_start_date=date(2026, 8, 10),
            planned_finish_date=date(2026, 8, 25),
        )
        assert act.code == "PIP-2400"
        assert act.discipline == DisciplineEnum.PIPING

    def test_optional_fields_default_none(self):
        act = ScheduleActivity(
            id=uuid4(),
            project_id=uuid4(),
            code="CIV-1100",
            name="Rebar Work",
            discipline=DisciplineEnum.CIVIL,
            planned_start_date=date(2026, 8, 15),
            planned_finish_date=date(2026, 8, 24),
        )
        assert act.description is None
        assert act.location is None
        assert act.embedding is None

    def test_with_embedding(self):
        act = ScheduleActivity(
            id=uuid4(),
            project_id=uuid4(),
            code="PIP-2400",
            name="Spool Erection",
            discipline=DisciplineEnum.PIPING,
            planned_start_date=date(2026, 8, 10),
            planned_finish_date=date(2026, 8, 25),
            embedding=[0.1] * 384,
        )
        assert len(act.embedding) == 384


# =============================================================================
# MatchCandidate Tests
# =============================================================================

class TestMatchCandidate:
    def test_creation(self):
        mc = MatchCandidate(
            activity_id=uuid4(),
            activity_code="PIP-2401",
            activity_name="Hydrostatic Testing",
            confidence_score=0.92,
            match_tier=MatchTierEnum.HIGH,
            explanation="Equipment tag match",
            evidence_snippet="P-101 testing",
        )
        assert mc.confidence_score == 0.92
        assert mc.match_tier == MatchTierEnum.HIGH

    def test_default_scores(self):
        mc = MatchCandidate(
            activity_id=uuid4(),
            activity_code="CIV-1100",
            activity_name="Rebar Work",
            confidence_score=0.5,
            match_tier=MatchTierEnum.MEDIUM,
            explanation="Partial match",
            evidence_snippet="rebar",
        )
        assert mc.lexical_score == 0.0
        assert mc.semantic_score == 0.0
        assert mc.context_boost == 0.0
        assert mc.candidate_rank == 1


# =============================================================================
# API Request/Response Schema Tests
# =============================================================================

class TestAPISchemas:
    def test_extract_request(self):
        req = ExtractRequest(project_id=uuid4())
        assert req.source_type == "DAILY_REPORT"
        assert req.text_content is None

    def test_normalize_request(self):
        req = NormalizeRequest(project_id=uuid4(), text="hydro test on p-101")
        assert req.discipline is None

    def test_embed_request(self):
        req = EmbedRequest(texts=["spool erection", "concrete pour"])
        assert len(req.texts) == 2

    def test_embed_response(self):
        resp = EmbedResponse(embeddings=[[0.1, 0.2], [0.3, 0.4]], dimension=2)
        assert resp.dimension == 2
        assert len(resp.embeddings) == 2

    def test_match_request(self):
        pid = uuid4()
        obs = NormalizedObservation(raw_text="a", normalized_text="A", project_id=pid)
        act = ScheduleActivity(
            id=uuid4(), project_id=pid, code="T-1", name="Test",
            discipline=DisciplineEnum.GENERAL,
            planned_start_date=date(2026, 1, 1), planned_finish_date=date(2026, 1, 31)
        )
        req = MatchRequest(project_id=pid, observations=[obs], activities=[act])
        assert len(req.observations) == 1
        assert len(req.activities) == 1

    def test_process_document_message(self):
        msg = ProcessDocumentMessage(
            correlation_id="corr-123",
            project_id=uuid4(),
            document_id=uuid4(),
            job_id=uuid4(),
            storage_key="uploads/report.pdf",
            source_type="DAILY_REPORT",
            filename="report.pdf",
        )
        assert msg.filename == "report.pdf"
        assert msg.text_content is None


# =============================================================================
# MatchProposalPayload Tests
# =============================================================================

class TestMatchProposalPayload:
    def test_empty_candidates(self):
        obs = NormalizedObservation(raw_text="a", normalized_text="A", project_id=uuid4())
        payload = MatchProposalPayload(observation=obs, candidates=[])
        assert payload.top_match is None
        assert payload.auto_link_eligible is False

    def test_with_top_match(self):
        obs = NormalizedObservation(raw_text="a", normalized_text="A", project_id=uuid4())
        mc = MatchCandidate(
            activity_id=uuid4(), activity_code="PIP-2401",
            activity_name="Test", confidence_score=0.95,
            match_tier=MatchTierEnum.HIGH, explanation="match",
            evidence_snippet="evidence"
        )
        payload = MatchProposalPayload(
            observation=obs, candidates=[mc], top_match=mc, auto_link_eligible=True
        )
        assert payload.top_match.confidence_score == 0.95
        assert payload.auto_link_eligible is True
