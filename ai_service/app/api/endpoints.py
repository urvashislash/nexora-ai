import logging
from typing import List
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from uuid import UUID, uuid4

from app.models.schemas import (
    EmbedRequest,
    EmbedResponse,
    ExtractRequest,
    MatchProposalPayload,
    MatchRequest,
    NormalizedObservation,
    NormalizeRequest,
    ScheduleActivity,
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
        "dimension": 384
    }


@router.post("/extract", response_model=List[NormalizedObservation])
async def extract_observations(payload: ExtractRequest):
    """
    Extracts structured field observations from text or document metadata.
    """
    if not payload.text_content:
        return []
    
    observations = DocumentExtractor.extract_from_text(
        text=payload.text_content,
        project_id=payload.project_id,
        document_id=payload.document_id
    )
    return observations


@router.post("/extract-file", response_model=List[NormalizedObservation])
async def extract_observations_from_file(
    project_id: UUID = Form(...),
    document_id: UUID = Form(default_factory=uuid4),
    file: UploadFile = File(...)
):
    """
    Ingests binary file (Excel, CSV, or Text) and extracts observations.
    """
    content = await file.read()
    filename = file.filename or ""

    if filename.endswith((".xlsx", ".xls", ".csv")):
        observations = DocumentExtractor.extract_from_excel_bytes(
            content=content,
            project_id=project_id,
            document_id=document_id
        )
    else:
        text = content.decode("utf-8", errors="ignore")
        observations = DocumentExtractor.extract_from_text(
            text=text,
            project_id=project_id,
            document_id=document_id
        )

    return observations


@router.post("/normalize")
async def normalize_text(payload: NormalizeRequest):
    """
    Normalizes site jargon and acronyms to standard schedule terminology.
    """
    normalized = default_normalizer.normalize(payload.text, payload.discipline)
    return {
        "raw_text": payload.text,
        "normalized_text": normalized,
        "discipline": payload.discipline
    }


@router.post("/embed", response_model=EmbedResponse)
async def generate_embeddings(payload: EmbedRequest):
    """
    Generates 384-dimensional sentence-transformers embeddings.
    """
    embeddings = compute_embeddings(payload.texts)
    return EmbedResponse(
        embeddings=embeddings,
        dimension=len(embeddings[0]) if embeddings else 384
    )


@router.post("/match", response_model=List[MatchProposalPayload])
async def match_observations(payload: MatchRequest):
    """
    Executes hybrid matching for a list of observations against project activities.
    """
    proposals = []
    for obs in payload.observations:
        proposal = HybridMatcher.match_observation(
            observation=obs,
            activities=payload.activities
        )
        proposals.append(proposal)

    return proposals
