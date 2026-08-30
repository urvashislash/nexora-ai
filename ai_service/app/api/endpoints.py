import json
import time
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.core.security import (
    embed_rate_limiter,
    extract_rate_limiter,
    pipeline_rate_limiter,
    sanitize_filename,
    validate_file_content,
)
from app.models.schemas import (
    EmbedRequest,
    EmbedResponse,
    ExtractRequest,
    MatchDecisionEnum,
    MatchProposalPayload,
    MatchRequest,
    NormalizedObservation,
    NormalizeRequest,
    PipelineProcessRequest,
    PipelineProcessResult,
    PipelineStageStatus,
    ScheduleActivity,
    ScheduleImportResult,
)
from app.services.embeddings import compute_embeddings, embedding_backend_info
from app.services.extractor import DocumentExtractor
from app.services.matcher import HybridMatcher
from app.services.media import MediaProcessingError
from app.services.normalizer import default_normalizer

router = APIRouter()


def _get_client_ip(request: Request) -> str:
    if request.headers.get("x-forwarded-for"):
        return request.headers["x-forwarded-for"].split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@router.get("/health")
async def health_check():
    embedding_info = embedding_backend_info()
    return {
        "status": "healthy",
        "service": "ai_service",
        "model": embedding_info["model"],
        "dimension": embedding_info["dimension"],
        "embeddings": embedding_info,
    }


@router.post("/extract", response_model=list[NormalizedObservation])
async def extract_observations(payload: ExtractRequest, request: Request):
    """
    Extracts structured field observations from text or document metadata.
    """
    extract_rate_limiter.check(_get_client_ip(request))

    if not payload.text_content:
        return []

    observations = DocumentExtractor.extract_from_text(
        text=payload.text_content,
        project_id=payload.project_id,
        document_id=payload.document_id,
        source_type=payload.source_type,
    )
    return observations


@router.post("/extract-file", response_model=list[NormalizedObservation])
async def extract_observations_from_file(
    request: Request,
    project_id: UUID = Form(...),
    document_id: UUID | None = Form(None),
    source_type: str = Form("DAILY_REPORT"),
    file: UploadFile = File(...),
):
    """
    Ingests binary file (PDF, Excel, CSV, or Text) and extracts observations.
    Validates file size, MIME type, and magic bytes.
    """
    extract_rate_limiter.check(_get_client_ip(request))
    safe_filename = sanitize_filename(file.filename)

    content = await file.read()
    validate_file_content(content, safe_filename, file.content_type)

    try:
        return DocumentExtractor.extract_document(
            content,
            project_id,
            document_id or uuid4(),
            filename=safe_filename,
            mime_type=file.content_type,
            source_type=source_type,
        )
    except MediaProcessingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/schedule/import-file", response_model=ScheduleImportResult)
async def import_schedule_file(
    request: Request,
    project_id: UUID = Form(...),
    file: UploadFile = File(...)
):
    """Parse P6/MS Project-style CSV, XLS, or XLSX exports into normalized schedule activities."""
    pipeline_rate_limiter.check(_get_client_ip(request))
    safe_filename = sanitize_filename(file.filename or "schedule.xlsx")

    content = await file.read()
    validate_file_content(content, safe_filename, file.content_type)

    try:
        return DocumentExtractor.extract_schedule_from_tabular_bytes(
            content,
            project_id,
            filename=safe_filename,
        )
    except MediaProcessingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/normalize")
async def normalize_text(payload: NormalizeRequest, request: Request):
    """
    Normalizes site jargon and acronyms to standard schedule terminology.
    """
    extract_rate_limiter.check(_get_client_ip(request))
    normalized = default_normalizer.normalize(payload.text, payload.discipline)
    return {"raw_text": payload.text, "normalized_text": normalized, "discipline": payload.discipline}


@router.post("/embed", response_model=EmbedResponse)
async def generate_embeddings(payload: EmbedRequest, request: Request):
    """
    Generates 384-dimensional sentence-transformers embeddings.
    """
    embed_rate_limiter.check(_get_client_ip(request))
    embeddings = compute_embeddings(payload.texts)
    return EmbedResponse(embeddings=embeddings, dimension=len(embeddings[0]) if embeddings else 384)


@router.post("/match", response_model=list[MatchProposalPayload])
async def match_observations(payload: MatchRequest, request: Request):
    """
    Executes hybrid matching for a list of observations against project activities.
    """
    pipeline_rate_limiter.check(_get_client_ip(request))
    proposals = []
    for obs in payload.observations:
        proposal = HybridMatcher.match_observation(observation=obs, activities=payload.activities)
        proposals.append(proposal)

    return proposals


@router.post("/pipeline/process", response_model=PipelineProcessResult)
async def process_pipeline(payload: PipelineProcessRequest, request: Request):
    """
    Executes the full end-to-end ingestion pipeline:
    parse -> extract -> normalize -> embed -> hybrid match.
    """
    pipeline_rate_limiter.check(_get_client_ip(request))
    stages: list[PipelineStageStatus] = []
    t0 = time.perf_counter()

    # Stage 1: Extraction & Normalization
    if payload.text_content:
        observations = DocumentExtractor.extract_from_text(
            text=payload.text_content,
            project_id=payload.project_id,
            document_id=payload.document_id,
            source_type=payload.source_type,
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

        if proposal.decision == MatchDecisionEnum.AUTO_LINK:
            auto_link_count += 1
        elif proposal.decision == MatchDecisionEnum.REVIEW_REQUIRED:
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


@router.post("/pipeline/process-file", response_model=PipelineProcessResult)
async def process_file_pipeline(
    request: Request,
    project_id: UUID = Form(...),
    document_id: UUID | None = Form(None),
    source_type: str = Form("DAILY_REPORT"),
    activities_json: str = Form("[]"),
    file: UploadFile = File(...),
):
    """Execute parse/OCR/ASR, normalization, embedding, matching, and review routing for a file."""
    pipeline_rate_limiter.check(_get_client_ip(request))
    safe_filename = sanitize_filename(file.filename or "evidence.bin")

    content = await file.read()
    validate_file_content(content, safe_filename, file.content_type)

    try:
        raw_activities = json.loads(activities_json)
        activities = [ScheduleActivity.model_validate(item) for item in raw_activities]
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid activities_json: {exc}") from exc

    resolved_document_id = document_id or uuid4()
    start = time.perf_counter()
    try:
        observations = DocumentExtractor.extract_document(
            content,
            project_id,
            resolved_document_id,
            filename=safe_filename,
            mime_type=file.content_type,
            source_type=source_type,
        )
    except MediaProcessingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    extracted_at = time.perf_counter()
    observations = HybridMatcher.deduplicate_observations(observations)
    proposals = [HybridMatcher.match_observation(observation, activities) for observation in observations]
    completed_at = time.perf_counter()

    return PipelineProcessResult(
        project_id=project_id,
        document_id=resolved_document_id,
        observations=observations,
        proposals=proposals,
        stages=[
            PipelineStageStatus(
                stage="PARSE_EXTRACT_NORMALIZE",
                status="COMPLETED",
                items_processed=len(observations),
                duration_ms=round((extracted_at - start) * 1000, 2),
            ),
            PipelineStageStatus(
                stage="EMBED_MATCH_ROUTE",
                status="COMPLETED",
                items_processed=len(proposals),
                duration_ms=round((completed_at - extracted_at) * 1000, 2),
            ),
        ],
        auto_link_count=sum(proposal.decision == MatchDecisionEnum.AUTO_LINK for proposal in proposals),
        review_required_count=sum(
            proposal.decision == MatchDecisionEnum.REVIEW_REQUIRED for proposal in proposals
        ),
        unmatched_count=sum(proposal.decision == MatchDecisionEnum.REJECTED for proposal in proposals),
    )
