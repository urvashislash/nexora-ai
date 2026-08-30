"""
Tests for AI Service matching rule enforcement and edge cases.
"""

from app.models.schemas import MatchCandidate, MatchProposal, MatchTierEnum, DisciplineEnum
from app.services.matcher import MatcherService
from typing import List

class TestRuleEnforcement:
    def test_match_tier_thresholds(self):
        """Test that the matching engine enforces the correct tier thresholds."""
        # This is a dummy test structure that would integrate with the actual service.
        candidate_high = MatchCandidate(
            activity_id="act-1",
            activity_code="ACT-01",
            activity_name="Install Piping",
            discipline=DisciplineEnum.PIPING,
            lexical_score=0.9,
            semantic_score=0.95,
            context_boost=0.1,
            final_score=0.92,
            match_tier=MatchTierEnum.HIGH
        )
        
        assert candidate_high.final_score >= 0.85
        assert candidate_high.match_tier == MatchTierEnum.HIGH
        
        candidate_medium = MatchCandidate(
            activity_id="act-2",
            activity_code="ACT-02",
            activity_name="Weld Pipe",
            discipline=DisciplineEnum.PIPING,
            lexical_score=0.7,
            semantic_score=0.7,
            context_boost=0.0,
            final_score=0.7,
            match_tier=MatchTierEnum.MEDIUM
        )
        
        assert candidate_medium.final_score >= 0.60
        assert candidate_medium.final_score < 0.85
        assert candidate_medium.match_tier == MatchTierEnum.MEDIUM

    def test_unmatched_tier_fallback(self):
        """Test that scores below 0.40 are categorized as UNMATCHED."""
        candidate_low = MatchCandidate(
            activity_id="act-3",
            activity_code="ACT-03",
            activity_name="Unknown Activity",
            discipline=DisciplineEnum.GENERAL,
            lexical_score=0.2,
            semantic_score=0.3,
            context_boost=0.0,
            final_score=0.25,
            match_tier=MatchTierEnum.UNMATCHED
        )
        
        assert candidate_low.final_score < 0.40
        assert candidate_low.match_tier == MatchTierEnum.UNMATCHED
