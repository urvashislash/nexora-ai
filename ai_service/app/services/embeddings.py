import hashlib
import logging
import math
from typing import Any, Literal, Protocol

from app.core.config import settings

logger = logging.getLogger(__name__)

FallbackEmbeddingModel = Literal["FALLBACK"]


class EmbeddingModel(Protocol):
    def encode(self, texts: list[str], normalize_embeddings: bool) -> Any: ...


_model: EmbeddingModel | FallbackEmbeddingModel | None = None


def get_embedding_model() -> EmbeddingModel | FallbackEmbeddingModel:
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer

            logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
            _model = SentenceTransformer(settings.EMBEDDING_MODEL)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Could not load SentenceTransformer ({e}). Falling back to fast hash-vector projection.")
            _model = "FALLBACK"
    return _model


def generate_fallback_embedding(text: str, dim: int = 384) -> list[float]:
    """
    Deterministic pseudo-semantic projection for fast local testing/offline CI.
    Generates a normalized 384-dimensional vector based on token hashes.
    """
    vector = [0.0] * dim
    tokens = text.lower().replace("-", " ").replace("_", " ").split()
    if not tokens:
        return vector

    for i, token in enumerate(tokens):
        h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        sign = 1.0 if ((h >> 8) & 1) else -1.0
        weight = 1.0 / (1.0 + 0.1 * i)
        vector[idx] += sign * weight

    norm = math.sqrt(sum(x * x for x in vector))
    if norm > 0:
        vector = [x / norm for x in vector]
    return vector


def compute_embeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    model = get_embedding_model()
    if model != "FALLBACK":
        try:
            raw_embeddings = model.encode(texts, normalize_embeddings=True)
            return [emb.tolist() for emb in raw_embeddings]
        except Exception as e:  # noqa: BLE001
            logger.error(f"Error during model.encode: {e}. Using fallback.")

    return [generate_fallback_embedding(t, settings.EMBEDDING_DIM) for t in texts]


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b, strict=False))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    sim = dot / (norm_a * norm_b)
    return max(0.0, min(1.0, (sim + 1.0) / 2.0 if sim < 0 else sim))
