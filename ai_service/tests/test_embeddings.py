"""
Comprehensive tests for the embeddings service.
Tests model loading, fallback embedding generation, compute_embeddings,
and cosine similarity calculations.
"""

import math

from app.core.config import settings
from app.services.embeddings import (
    compute_embeddings,
    cosine_similarity,
    generate_fallback_embedding,
    get_embedding_model,
)

# =============================================================================
# Fallback Embedding Tests
# =============================================================================


class TestFallbackEmbedding:
    """Tests for the deterministic hash-projection fallback embeddings."""

    def test_default_dimension(self):
        vec = generate_fallback_embedding("test text")
        assert len(vec) == 384

    def test_custom_dimension(self):
        vec = generate_fallback_embedding("test text", dim=128)
        assert len(vec) == 128

    def test_deterministic(self):
        vec1 = generate_fallback_embedding("spool erection on pipe rack B")
        vec2 = generate_fallback_embedding("spool erection on pipe rack B")
        assert vec1 == vec2

    def test_different_texts_produce_different_vectors(self):
        vec1 = generate_fallback_embedding("spool erection")
        vec2 = generate_fallback_embedding("concrete pour")
        assert vec1 != vec2

    def test_normalized_unit_vector(self):
        vec = generate_fallback_embedding("piping work on rack B")
        norm = math.sqrt(sum(x * x for x in vec))
        assert abs(norm - 1.0) < 0.001

    def test_empty_text_returns_zero_vector(self):
        vec = generate_fallback_embedding("")
        assert all(x == 0.0 for x in vec)

    def test_single_word(self):
        vec = generate_fallback_embedding("concrete")
        assert len(vec) == 384
        assert any(x != 0.0 for x in vec)

    def test_special_characters_handled(self):
        vec = generate_fallback_embedding("P-101 testing @ 42.5 bar")
        assert len(vec) == 384

    def test_hyphens_replaced(self):
        # Hyphens should be treated as spaces for token splitting
        vec = generate_fallback_embedding("hydro-test")
        assert len(vec) == 384
        assert any(x != 0.0 for x in vec)

    def test_underscores_replaced(self):
        vec = generate_fallback_embedding("pipe_rack_b")
        assert len(vec) == 384

    def test_case_insensitive(self):
        vec1 = generate_fallback_embedding("CONCRETE POUR")
        vec2 = generate_fallback_embedding("concrete pour")
        assert vec1 == vec2

    def test_similar_texts_have_some_similarity(self):
        vec1 = generate_fallback_embedding("spool erection on pipe rack B")
        vec2 = generate_fallback_embedding("spool erection on pipe rack A")
        sim = cosine_similarity(vec1, vec2)
        assert sim > 0.5  # Should share most tokens


# =============================================================================
# Compute Embeddings Tests
# =============================================================================


class TestComputeEmbeddings:
    """Tests for compute_embeddings batch processing."""

    def test_empty_list(self):
        result = compute_embeddings([])
        assert result == []

    def test_single_text(self):
        result = compute_embeddings(["spool erection"])
        assert len(result) == 1
        assert len(result[0]) == settings.EMBEDDING_DIM

    def test_multiple_texts(self):
        texts = ["spool erection", "concrete pour", "cable tray installation"]
        result = compute_embeddings(texts)
        assert len(result) == 3
        for emb in result:
            assert len(emb) == settings.EMBEDDING_DIM

    def test_output_are_lists_of_floats(self):
        result = compute_embeddings(["test"])
        assert isinstance(result[0], list)
        assert all(isinstance(x, float) for x in result[0])


# =============================================================================
# Cosine Similarity Tests
# =============================================================================


class TestCosineSimilarity:
    """Tests for cosine similarity computation."""

    def test_identical_vectors(self):
        vec = [0.5, 0.3, 0.8, 0.1]
        assert abs(cosine_similarity(vec, vec) - 1.0) < 0.001

    def test_orthogonal_vectors(self):
        vec_a = [1.0, 0.0, 0.0]
        vec_b = [0.0, 1.0, 0.0]
        sim = cosine_similarity(vec_a, vec_b)
        assert abs(sim) < 0.001

    def test_opposite_vectors(self):
        vec_a = [1.0, 0.0]
        vec_b = [-1.0, 0.0]
        sim = cosine_similarity(vec_a, vec_b)
        assert sim == 0.0  # Clamped to [0, 1]

    def test_empty_vectors(self):
        assert cosine_similarity([], []) == 0.0

    def test_mismatched_dimensions(self):
        assert cosine_similarity([1.0, 2.0], [1.0]) == 0.0

    def test_zero_vectors(self):
        assert cosine_similarity([0.0, 0.0], [0.0, 0.0]) == 0.0

    def test_one_zero_vector(self):
        assert cosine_similarity([1.0, 0.5], [0.0, 0.0]) == 0.0

    def test_similar_vectors_high_score(self):
        vec_a = [0.8, 0.6, 0.0]
        vec_b = [0.7, 0.7, 0.1]
        sim = cosine_similarity(vec_a, vec_b)
        assert sim > 0.9

    def test_result_bounded_zero_one(self):
        # Should always return [0, 1]
        for _ in range(20):
            import random

            a = [random.uniform(-1, 1) for _ in range(10)]
            b = [random.uniform(-1, 1) for _ in range(10)]
            sim = cosine_similarity(a, b)
            assert 0.0 <= sim <= 1.0

    def test_symmetry(self):
        vec_a = [0.3, 0.7, 0.1]
        vec_b = [0.5, 0.2, 0.9]
        assert abs(cosine_similarity(vec_a, vec_b) - cosine_similarity(vec_b, vec_a)) < 0.0001


# =============================================================================
# Model Loading Tests
# =============================================================================


class TestModelLoading:
    def test_get_embedding_model_returns_something(self):
        model = get_embedding_model()
        assert model is not None

    def test_model_is_cached(self):
        model1 = get_embedding_model()
        model2 = get_embedding_model()
        assert model1 is model2
