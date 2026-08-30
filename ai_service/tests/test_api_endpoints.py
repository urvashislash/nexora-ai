"""
Comprehensive tests for FastAPI HTTP API endpoints.
Tests all endpoints: GET /, GET /api/v1/health, POST /api/v1/extract,
POST /api/v1/extract-file, POST /api/v1/normalize, POST /api/v1/embed, POST /api/v1/match.
"""
import io
from uuid import uuid4
from datetime import date
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import DisciplineEnum, EventTypeEnum


@pytest.fixture
def client():
    return TestClient(app)


# =============================================================================
# Root & Health Endpoints
# =============================================================================

class TestRootAndHealth:
    def test_root_endpoint(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert "NEXORA AI" in data["service"]
        assert "version" in data
        assert "docs" in data

    def test_health_check_endpoint(self, client):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "ai_service"
        assert data["dimension"] == 384


# =============================================================================
# Normalize Endpoint
# =============================================================================

class TestNormalizeEndpoint:
    def test_normalize_basic(self, client):
        project_id = str(uuid4())
        payload = {
            "project_id": project_id,
            "text": "hydro test on p-101 line yesterday",
            "discipline": "PIPING",
        }
        response = client.post("/api/v1/normalize", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["raw_text"] == payload["text"]
        assert "Hydrostatic Testing" in data["normalized_text"]
        assert "Line P-101" in data["normalized_text"]
        assert data["discipline"] == "PIPING"

    def test_normalize_without_discipline(self, client):
        project_id = str(uuid4())
        payload = {
            "project_id": project_id,
            "text": "concrete pour for footing",
        }
        response = client.post("/api/v1/normalize", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "Concrete Pour" in data["normalized_text"]
        assert data["discipline"] is None

    def test_normalize_empty_text(self, client):
        project_id = str(uuid4())
        payload = {
            "project_id": project_id,
            "text": "",
        }
        response = client.post("/api/v1/normalize", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["normalized_text"] == ""


# =============================================================================
# Extract Endpoint
# =============================================================================

class TestExtractEndpoint:
    def test_extract_text_content(self, client):
        project_id = str(uuid4())
        payload = {
            "project_id": project_id,
            "text_content": "1. Spool erection complete on Pipe Rack B Tier 2 (100% finished).\n2. Concrete pour started.",
            "source_type": "DAILY_REPORT",
        }
        response = client.post("/api/v1/extract", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        assert data[0]["discipline"] == "PIPING"
        assert data[0]["reported_progress"] == 100.0

    def test_extract_empty_text(self, client):
        project_id = str(uuid4())
        payload = {
            "project_id": project_id,
            "text_content": "",
            "source_type": "DAILY_REPORT",
        }
        response = client.post("/api/v1/extract", json=payload)
        assert response.status_code == 200
        assert response.json() == []

    def test_extract_none_text(self, client):
        project_id = str(uuid4())
        payload = {
            "project_id": project_id,
            "text_content": None,
            "source_type": "DAILY_REPORT",
        }
        response = client.post("/api/v1/extract", json=payload)
        assert response.status_code == 200
        assert response.json() == []


# =============================================================================
# Extract-File Endpoint
# =============================================================================

class TestExtractFileEndpoint:
    def test_extract_from_text_file(self, client):
        project_id = str(uuid4())
        content = b"Spool erection on Pipe Rack B finished (100% complete).\nRebar tying in progress."
        files = {"file": ("report.txt", io.BytesIO(content), "text/plain")}
        data = {"project_id": project_id}
        
        response = client.post("/api/v1/extract-file", data=data, files=files)
        assert response.status_code == 200
        observations = response.json()
        assert len(observations) >= 2

    def test_extract_from_csv_file(self, client):
        project_id = str(uuid4())
        content = b"activity_id,description,status,discipline\nPIP-2400,Spool erection,100% complete,Piping\nCIV-1100,Rebar work,50% in progress,Civil"
        files = {"file": ("log.csv", io.BytesIO(content), "text/csv")}
        data = {"project_id": project_id}
        
        response = client.post("/api/v1/extract-file", data=data, files=files)
        assert response.status_code == 200
        observations = response.json()
        assert len(observations) >= 2


# =============================================================================
# Embed Endpoint
# =============================================================================

class TestEmbedEndpoint:
    def test_embed_texts(self, client):
        payload = {
            "texts": [
                "Hydrostatic pressure testing",
                "Concrete pouring for foundation",
                "Cable tray installation",
            ]
        }
        response = client.post("/api/v1/embed", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["dimension"] == 384
        assert len(data["embeddings"]) == 3
        assert len(data["embeddings"][0]) == 384

    def test_embed_empty_list(self, client):
        payload: dict[str, list[str]] = {"texts": []}
        response = client.post("/api/v1/embed", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["embeddings"] == []
        assert data["dimension"] == 384


# =============================================================================
# Match Endpoint
# =============================================================================

class TestMatchEndpoint:
    def test_match_observations_against_activities(self, client):
        project_id = str(uuid4())
        act_id = str(uuid4())
        obs_id = str(uuid4())

        payload = {
            "project_id": project_id,
            "observations": [
                {
                    "id": obs_id,
                    "project_id": project_id,
                    "raw_text": "P-101 completed",
                    "normalized_text": "Line P-101 completed",
                    "discipline": "PIPING",
                    "equipment_tag": "LINE-P-101",
                    "event_type": "FINISH",
                    "reported_progress": 100.0,
                    "extraction_confidence": 0.95,
                }
            ],
            "activities": [
                {
                    "id": act_id,
                    "project_id": project_id,
                    "code": "PIP-2401",
                    "name": "Hydrostatic Testing - Line P-101 (Crude Feed Header)",
                    "description": "Pressure testing of 24 inch crude feed header Line P-101 at 42.5 bar",
                    "discipline": "PIPING",
                    "location": "Pipe Rack B",
                    "zone": "Zone 2",
                    "equipment_tag": "LINE-P-101",
                    "planned_start_date": "2026-08-26",
                    "planned_finish_date": "2026-08-28",
                }
            ],
        }

        response = client.post("/api/v1/match", json=payload)
        assert response.status_code == 200
        proposals = response.json()
        assert len(proposals) == 1
        assert proposals[0]["top_match"] is not None
        assert proposals[0]["top_match"]["activity_code"] == "PIP-2401"
        assert proposals[0]["top_match"]["confidence_score"] >= 0.85
