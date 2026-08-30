import hashlib
import logging
import math
import re
from functools import lru_cache
from typing import Any, Literal, Protocol, cast

from app.core.config import settings
from app.models.schemas import NormalizedObservation, ScheduleActivity

logger = logging.getLogger(__name__)

FallbackEmbeddingModel = Literal["FALLBACK"]


class EmbeddingModel(Protocol):
    def encode(self, texts: list[str], **kwargs: Any) -> Any: ...


_model: EmbeddingModel | FallbackEmbeddingModel | None = None
_active_backend = "uninitialized"


def get_embedding_model() -> EmbeddingModel | FallbackEmbeddingModel:
    global _active_backend, _model
    if _model is not None:
        return _model

    backend = settings.EMBEDDING_BACKEND.strip().lower()
    if backend in {"hash", "fallback", "offline"}:
        _model = "FALLBACK"
        _active_backend = "hash-fallback"
        return _model
    if backend not in {"auto", "sentence-transformer", "sentence_transformer"}:
        raise ValueError(f"Unsupported embedding backend: {settings.EMBEDDING_BACKEND}")

    try:
        from sentence_transformers import SentenceTransformer

        logger.info("Loading embedding model %s", settings.EMBEDDING_MODEL)
        model = SentenceTransformer(
            settings.EMBEDDING_MODEL,
            local_files_only=not settings.EMBEDDING_ALLOW_DOWNLOAD,
        )
        _model = cast(EmbeddingModel, model)
        _active_backend = "sentence-transformer"
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "SentenceTransformer %s is unavailable (%s); using deterministic offline embeddings",
            settings.EMBEDDING_MODEL,
            exc,
        )
        _model = "FALLBACK"
        _active_backend = "hash-fallback"
    return _model


def embedding_backend_info() -> dict[str, Any]:
    return {
        "configured_backend": settings.EMBEDDING_BACKEND,
        "active_backend": _active_backend,
        "model": settings.EMBEDDING_MODEL,
        "dimension": settings.EMBEDDING_DIM,
        "download_enabled": settings.EMBEDDING_ALLOW_DOWNLOAD,
    }


def _feature_tokens(text: str) -> list[str]:
    normalized = re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
    tokens = normalized.split()
    bigrams = [f"{left}_{right}" for left, right in zip(tokens, tokens[1:], strict=False)]
    return tokens + bigrams


@lru_cache(maxsize=8192)
def _cached_fallback_embedding(text: str, dim: int) -> tuple[float, ...]:
    vector = [0.0] * dim
    tokens = _feature_tokens(text)
    if not tokens:
        return tuple(vector)

    for index, token in enumerate(tokens):
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=16).digest()
        bucket = int.from_bytes(digest[:8], "big") % dim
        sign = 1.0 if digest[8] & 1 else -1.0
        is_bigram = "_" in token
        position_weight = 1.0 / (1.0 + 0.02 * index)
        vector[bucket] += sign * position_weight * (1.15 if is_bigram else 1.0)

    norm = math.sqrt(sum(component * component for component in vector))
    return tuple(component / norm for component in vector) if norm else tuple(vector)


def generate_fallback_embedding(text: str, dim: int = 384) -> list[float]:
    """Deterministic normalized token/bigram embedding for offline CI and local recovery."""
    return list(_cached_fallback_embedding(text, dim))


def compute_embeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    model = get_embedding_model()
    if model != "FALLBACK":
        try:
            raw_embeddings = model.encode(
                texts,
                normalize_embeddings=True,
                batch_size=settings.EMBEDDING_BATCH_SIZE,
                show_progress_bar=False,
            )
            embeddings = [list(map(float, embedding.tolist())) for embedding in raw_embeddings]
            if any(len(embedding) != settings.EMBEDDING_DIM for embedding in embeddings):
                raise ValueError(
                    f"Embedding model returned a dimension other than {settings.EMBEDDING_DIM}"
                )
            return embeddings
        except Exception as exc:  # noqa: BLE001
            logger.error("Embedding inference failed (%s); using deterministic fallback", exc)

    return [generate_fallback_embedding(text, settings.EMBEDDING_DIM) for text in texts]


def build_observation_embedding_text(observation: NormalizedObservation) -> str:
    return " | ".join(
        value
        for value in (
            observation.normalized_text,
            observation.discipline.value if observation.discipline else None,
            observation.equipment_tag,
            observation.location,
            observation.zone,
            observation.event_type.value if observation.event_type else None,
        )
        if value
    )


def build_activity_embedding_text(activity: ScheduleActivity) -> str:
    return " | ".join(
        value
        for value in (
            activity.code,
            activity.name,
            activity.description,
            activity.discipline.value,
            activity.equipment_tag,
            activity.location,
            activity.zone,
        )
        if value
    )


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b, strict=False))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    similarity = dot / (norm_a * norm_b)
    return max(0.0, min(1.0, similarity))
