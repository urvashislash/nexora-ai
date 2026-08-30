from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional
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
    observed_at: Optional[datetime] = None
    discipline: Optional[DisciplineEnum] = None
    location: Optional[str] = None
    zone: Optional[str] = None
    equipment_tag: Optional[str] = None
    event_type: Optional[EventTypeEnum] = None
    reported_progress: Optional[float] = None
    reported_quantity: Optional[float] = None
    unit_of_measure: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class NormalizedObservation(RawObservation):
    id: UUID = Field(default_factory=uuid4)
    project_id: UUID
    document_id: Optional[UUID] = None
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
    description: Optional[str] = None
    discipline: DisciplineEnum
    location: Optional[str] = None
    zone: Optional[str] = None
    equipment_tag: Optional[str] = None
    planned_start_date: date
    planned_finish_date: date
    planned_quantity: Optional[float] = None
    unit_of_measure: Optional[str] = None
    embedding: Optional[List[float]] = None


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
    confidence_score: float
    match_tier: MatchTierEnum
    explanation: str
    evidence_snippet: str


class MatchProposalPayload(BaseModel):
    observation: NormalizedObservation
    candidates: List[MatchCandidate]
    top_match: Optional[MatchCandidate] = None
    auto_link_eligible: bool = False


# -----------------------------------------------------------------------------
# API Request / Response Schemas
# -----------------------------------------------------------------------------
class ExtractRequest(BaseModel):
    project_id: UUID
    document_id: Optional[UUID] = None
    source_type: str = "DAILY_REPORT"
    text_content: Optional[str] = None


class NormalizeRequest(BaseModel):
    project_id: UUID
    text: str
    discipline: Optional[DisciplineEnum] = None


class EmbedRequest(BaseModel):
    texts: List[str]


class EmbedResponse(BaseModel):
    embeddings: List[List[float]]
    dimension: int


class MatchRequest(BaseModel):
    project_id: UUID
    observations: List[NormalizedObservation]
    activities: List[ScheduleActivity]


class ProcessDocumentMessage(BaseModel):
    correlation_id: str
    project_id: UUID
    document_id: UUID
    job_id: UUID
    storage_key: str
    source_type: str
    filename: str
    text_content: Optional[str] = None
