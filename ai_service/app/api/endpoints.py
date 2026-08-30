import logging
import time
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, UploadFile

from app.models.schemas import (
    EmbedRequest,
    EmbedResponse,
    ExtractRequest,
    MatchProposalPayload,
    MatchRequest,
    MatchTierEnum,
    NormalizedObservation,
    NormalizeRequest,
    PipelineProcessRequest,
    PipelineProcessResult,
    PipelineStageStatus,
)
from app.services.embeddings import compute_embeddings
from app.services.extractor import DocumentExtractor
from app.services.matcher import HybridMatcher
from app.services.normalizer import default_normalizer

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ai_service",
        "model": "sentence-transformers/all-MiniLM-L6-v2",
        "dimension": 384,
    }


@router.post("/extract", response_model=list[NormalizedObservation])
async def extract_observations(payload: ExtractRequest):
    """
    Extracts structured field observations from text or document metadata.
    """
    if not payload.text_content:
        return []

    observations = DocumentExtractor.extract_from_text(
        text=payload.text_content, project_id=payload.project_id, document_id=payload.document_id
    )
    return observations


@router.post("/extract-file", response_model=list[NormalizedObservation])
async def extract_observations_from_file(
    project_id: UUID = Form(...), document_id: UUID = Form(default_factory=uuid4), file: UploadFile = File(...)
):
    """
    Ingests binary file (PDF, Excel, CSV, or Text) and extracts observations.
    """
    content = await file.read()
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()

    if filename.endswith(".pdf") or "pdf" in content_type:
        observations = DocumentExtractor.extract_from_pdf_bytes(
            content=content, project_id=project_id, document_id=document_id
        )
    elif filename.endswith((".xlsx", ".xls", ".csv")):
        observations = DocumentExtractor.extract_from_excel_bytes(
            content=content, project_id=project_id, document_id=document_id
        )
    else:
        text = content.decode("utf-8", errors="ignore")
        observations = DocumentExtractor.extract_from_text(text=text, project_id=project_id, document_id=document_id)

    return observations


@router.post("/normalize")
async def normalize_text(payload: NormalizeRequest):
    """
    Normalizes site jargon and acronyms to standard schedule terminology.
    """
    normalized = default_normalizer.normalize(payload.text, payload.discipline)
    return {"raw_text": payload.text, "normalized_text": normalized, "discipline": payload.discipline}


@router.post("/embed", response_model=EmbedResponse)
async def generate_embeddings(payload: EmbedRequest):
    """
    Generates 384-dimensional sentence-transformers embeddings.
    """
    embeddings = compute_embeddings(payload.texts)
    return EmbedResponse(embeddings=embeddings, dimension=len(embeddings[0]) if embeddings else 384)


@router.post("/match", response_model=list[MatchProposalPayload])
async def match_observations(payload: MatchRequest):
    """
    Executes hybrid matching for a list of observations against project activities.
    """
    proposals = []
    for obs in payload.observations:
        proposal = HybridMatcher.match_observation(observation=obs, activities=payload.activities)
        proposals.append(proposal)

    return proposals


@router.post("/pipeline/process", response_model=PipelineProcessResult)
async def process_pipeline(payload: PipelineProcessRequest):
    """
    Executes the full end-to-end ingestion pipeline:
    parse -> extract -> normalize -> embed -> hybrid match.
    """
    stages: list[PipelineStageStatus] = []
    t0 = time.perf_counter()

    # Stage 1: Extraction & Normalization
    if payload.text_content:
        observations = DocumentExtractor.extract_from_text(
            text=payload.text_content, project_id=payload.project_id, document_id=payload.document_id
        )
    else:
        observations = []

    t1 = time.perf_counter()
    stages.append(
        PipelineStageStatus(
            stage="EXTRACT_AND_NORMALIZE",
            status="COMPLETED",
            items_processed=len(observations),
            duration_ms=round((t1 - t0) * 1000, 2),
        )
    )

    # Stage 2: Hybrid Matching against schedule activities
    t2_start = time.perf_counter()
    proposals: list[MatchProposalPayload] = []
    auto_link_count = 0
    review_required_count = 0
    unmatched_count = 0

    for obs in observations:
        proposal = HybridMatcher.match_observation(observation=obs, activities=payload.activities)
        proposals.append(proposal)

        if proposal.auto_link_eligible:
            auto_link_count += 1
        elif proposal.top_match and proposal.top_match.match_tier != MatchTierEnum.UNMATCHED:
            review_required_count += 1
        else:
            unmatched_count += 1

    t2_end = time.perf_counter()
    stages.append(
        PipelineStageStatus(
            stage="HYBRID_MATCHING",
            status="COMPLETED",
            items_processed=len(proposals),
            duration_ms=round((t2_end - t2_start) * 1000, 2),
        )
    )

    return PipelineProcessResult(
        project_id=payload.project_id,
        document_id=payload.document_id,
        observations=observations,
        proposals=proposals,
        stages=stages,
        auto_link_count=auto_link_count,
        review_required_count=review_required_count,
        unmatched_count=unmatched_count,
    )

