import pytest

from app.services import embeddings


@pytest.fixture(autouse=True)
def deterministic_offline_embeddings(monkeypatch):
    """Tests must never download a model or depend on external network/cache state."""
    monkeypatch.setattr(embeddings, "_model", "FALLBACK")
    monkeypatch.setattr(embeddings, "_active_backend", "hash-fallback")
