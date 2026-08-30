from datetime import date, datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class DisciplineEnum(str, Enum):
    CIVIL = "CIVIL"
    PIPING = "PIPING"
    MECHANICAL = "MECHANICAL"
    ELECTRICAL = "ELECTRICAL"
    INSTRUMENTATION = "INSTRUMENTATION"
    HSE = "HSE"
    GENERAL = "GENERAL"


class EventTypeEnum(str, Enum):
    START = "START"
    PROGRESS = "PROGRESS"
    FINISH = "FINISH"
    DELAY = "DELAY"
    BLOCKER = "BLOCKER"
    INSPECTION = "INSPECTION"


class MatchTierEnum(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    UNMATCHED = "UNMATCHED"


class MatchDecisionEnum(str, Enum):
    AUTO_LINK = "AUTO_LINK"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    REJECTED = "REJECTED"


class DocumentJobType(str, Enum):
    PARSE = "PARSE"
    OCR = "OCR"
    ASR = "ASR"
    EXTRACT = "EXTRACT"
    NORMALIZE = "NORMALIZE"
    EMBED = "EMBED"
    MATCH = "MATCH"


# -----------------------------------------------------------------------------
# Observation Models
# -----------------------------------------------------------------------------
class RawObservation(BaseModel):
    raw_text: str
    observed_at: datetime | None = None
    discipline: DisciplineEnum | None = None
    location: str | None = None
    zone: str | None = None
    equipment_tag: str | None = None
    event_type: EventTypeEnum | None = None
    reported_progress: float | None = Field(default=None, ge=0.0, le=100.0)
    reported_quantity: float | None = Field(default=None, ge=0.0)
    unit_of_measure: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class NormalizedObservation(RawObservation):
    id: UUID = Field(default_factory=uuid4)
    project_id: UUID
    document_id: UUID | None = None
    normalized_text: str
    extraction_confidence: float = 1.0


# -----------------------------------------------------------------------------
# Activity Representation for Matching
# -----------------------------------------------------------------------------
class ScheduleActivity(BaseModel):
    id: UUID
    project_id: UUID
    code: str
    name: str
    description: str | None = None
    discipline: DisciplineEnum
    location: str | None = None
    zone: str | None = None
    equipment_tag: str | None = None
    planned_start_date: date
    planned_finish_date: date
    planned_quantity: float | None = None
    unit_of_measure: str | None = None
    embedding: list[float] | None = None


# -----------------------------------------------------------------------------
# Match Proposals
# -----------------------------------------------------------------------------
class MatchCandidate(BaseModel):
    activity_id: UUID
    activity_code: str
    activity_name: str
    candidate_rank: int = 1
    lexical_score: float = 0.0
    semantic_score: float = 0.0
    context_boost: float = 0.0
    discipline_match: bool = False
    equipment_match: bool = False
    location_match: bool = False
    confidence_score: float
    match_tier: MatchTierEnum
    explanation: str
    evidence_snippet: str


class MatchProposalPayload(BaseModel):
    observation: NormalizedObservation
    candidates: list[MatchCandidate]
    top_match: MatchCandidate | None = None
    auto_link_eligible: bool = False
    decision: MatchDecisionEnum = MatchDecisionEnum.REVIEW_REQUIRED
    review_required: bool = True
    decision_reason: str = "Match requires human review"
    score_gap: float | None = None
    policy_version: str = "construction-v1"


# -----------------------------------------------------------------------------
# API Request / Response Schemas
# -----------------------------------------------------------------------------
class ExtractRequest(BaseModel):
    project_id: UUID
    document_id: UUID | None = None
    source_type: str = "DAILY_REPORT"
    text_content: str | None = None


class NormalizeRequest(BaseModel):
    project_id: UUID
    text: str
    discipline: DisciplineEnum | None = None


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    dimension: int


class MatchRequest(BaseModel):
    project_id: UUID
    observations: list[NormalizedObservation]
    activities: list[ScheduleActivity]


class ProcessDocumentMessage(BaseModel):
    correlation_id: str
    project_id: UUID
    document_id: UUID
    job_id: UUID
    storage_key: str
    storage_bucket: str = "evidence-documents"
    source_type: str
    filename: str
    mime_type: str | None = None
    text_content: str | None = None
    content_base64: str | None = None
    activities: list[ScheduleActivity] = Field(default_factory=list)
    attempt: int = Field(default=0, ge=0)


# -----------------------------------------------------------------------------
# End-to-End Pipeline Schemas
# -----------------------------------------------------------------------------
class PipelineStageStatus(BaseModel):
    stage: str
    status: str
    items_processed: int
    duration_ms: float = 0.0


class PipelineProcessRequest(BaseModel):
    project_id: UUID
    document_id: UUID | None = None
    text_content: str | None = None
    source_type: str = "DAILY_REPORT"
    activities: list[ScheduleActivity] = Field(default_factory=list)


class PipelineProcessResult(BaseModel):
    project_id: UUID
    document_id: UUID | None = None
    observations: list[NormalizedObservation]
    proposals: list[MatchProposalPayload]
    stages: list[PipelineStageStatus]
    auto_link_count: int
    review_required_count: int
    unmatched_count: int


class ScheduleImportIssue(BaseModel):
    row_number: int
    field: str | None = None
    message: str


class ScheduleImportResult(BaseModel):
    activities: list[ScheduleActivity]
    issues: list[ScheduleImportIssue] = Field(default_factory=list)
    rows_processed: int = 0
