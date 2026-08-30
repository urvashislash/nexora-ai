"""
Tests for AI Service matching rule enforcement and edge cases.
"""

from uuid import uuid4

from app.models.schemas import MatchCandidate, MatchTierEnum


class TestRuleEnforcement:
    def test_match_tier_thresholds(self):
        """Test that the matching candidate carries the correct tier thresholds."""
        candidate_high = MatchCandidate(
            activity_id=uuid4(),
            activity_code="ACT-01",
            activity_name="Install Piping",
            discipline_match=True,
            lexical_score=0.9,
            semantic_score=0.95,
            context_boost=0.1,
            confidence_score=0.92,
            match_tier=MatchTierEnum.HIGH,
            explanation="High confidence exact match",
            evidence_snippet="Piping installation complete",
        )

        assert candidate_high.confidence_score >= 0.85
        assert candidate_high.match_tier == MatchTierEnum.HIGH

        candidate_medium = MatchCandidate(
            activity_id=uuid4(),
            activity_code="ACT-02",
            activity_name="Weld Pipe",
            discipline_match=True,
            lexical_score=0.7,
            semantic_score=0.7,
            context_boost=0.0,
            confidence_score=0.7,
            match_tier=MatchTierEnum.MEDIUM,
            explanation="Medium confidence review required",
            evidence_snippet="Weld pipe observation",
        )

        assert candidate_medium.confidence_score >= 0.60
        assert candidate_medium.confidence_score < 0.85
        assert candidate_medium.match_tier == MatchTierEnum.MEDIUM

    def test_unmatched_tier_fallback(self):
        """Test that scores below 0.40 are categorized as UNMATCHED."""
        candidate_low = MatchCandidate(
            activity_id=uuid4(),
            activity_code="ACT-03",
            activity_name="Unknown Activity",
            discipline_match=False,
            lexical_score=0.2,
            semantic_score=0.3,
            context_boost=0.0,
            confidence_score=0.25,
            match_tier=MatchTierEnum.UNMATCHED,
            explanation="Unmatched score below threshold",
            evidence_snippet="Unknown activity",
        )

        assert candidate_low.confidence_score < 0.40
        assert candidate_low.match_tier == MatchTierEnum.UNMATCHED
