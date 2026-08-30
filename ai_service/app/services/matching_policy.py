from dataclasses import dataclass

from app.core.config import settings
from app.models.schemas import MatchCandidate, MatchDecisionEnum, NormalizedObservation


@dataclass(frozen=True)
class MatchDecision:
    decision: MatchDecisionEnum
    auto_link_eligible: bool
    review_required: bool
    reason: str


@dataclass(frozen=True)
class MatchingThresholds:
    high_confidence: float
    review: float
    rejection: float
    min_auto_link_gap: float
    min_auto_lexical: float
    min_extraction_confidence: float
    version: str

    def __post_init__(self) -> None:
        if not 0.0 <= self.rejection <= self.review <= self.high_confidence <= 1.0:
            raise ValueError("Matching thresholds must satisfy rejection <= review <= high <= 1")

    @classmethod
    def from_settings(cls) -> "MatchingThresholds":
        return cls(
            high_confidence=settings.MATCH_HIGH_CONFIDENCE_THRESHOLD,
            review=settings.MATCH_REVIEW_THRESHOLD,
            rejection=settings.MATCH_REJECTION_THRESHOLD,
            min_auto_link_gap=settings.MATCH_MIN_AUTO_LINK_GAP,
            min_auto_lexical=settings.MATCH_MIN_AUTO_LEXICAL_SCORE,
            min_extraction_confidence=settings.MATCH_MIN_EXTRACTION_CONFIDENCE,
            version=settings.MATCH_POLICY_VERSION,
        )

    def decide(
        self,
        top_candidate: MatchCandidate | None,
        observation: NormalizedObservation,
        score_gap: float | None,
    ) -> MatchDecision:
        if top_candidate is None:
            return MatchDecision(
                decision=MatchDecisionEnum.REJECTED,
                auto_link_eligible=False,
                review_required=False,
                reason="No schedule candidates were available",
            )
        if top_candidate.confidence_score < self.rejection:
            return MatchDecision(
                decision=MatchDecisionEnum.REJECTED,
                auto_link_eligible=False,
                review_required=False,
                reason=(
                    f"Top confidence {top_candidate.confidence_score:.3f} is below the "
                    f"rejection boundary {self.rejection:.3f}"
                ),
            )
        if top_candidate.confidence_score < self.high_confidence:
            boundary = "review" if top_candidate.confidence_score >= self.review else "low-confidence review"
            return MatchDecision(
                decision=MatchDecisionEnum.REVIEW_REQUIRED,
                auto_link_eligible=False,
                review_required=True,
                reason=f"Candidate falls in the {boundary} band and must be confirmed by a planner",
            )
        if observation.extraction_confidence < self.min_extraction_confidence:
            return MatchDecision(
                decision=MatchDecisionEnum.REVIEW_REQUIRED,
                auto_link_eligible=False,
                review_required=True,
                reason="Source extraction confidence is too low for automatic linking",
            )
        if top_candidate.lexical_score < self.min_auto_lexical and not top_candidate.equipment_match:
            return MatchDecision(
                decision=MatchDecisionEnum.REVIEW_REQUIRED,
                auto_link_eligible=False,
                review_required=True,
                reason="Semantic confidence lacks a strong lexical or equipment identifier signal",
            )
        if score_gap is not None and score_gap < self.min_auto_link_gap:
            return MatchDecision(
                decision=MatchDecisionEnum.REVIEW_REQUIRED,
                auto_link_eligible=False,
                review_required=True,
                reason=(
                    f"Top candidates are ambiguous: score gap {score_gap:.3f} is below "
                    f"{self.min_auto_link_gap:.3f}"
                ),
            )
        return MatchDecision(
            decision=MatchDecisionEnum.AUTO_LINK,
            auto_link_eligible=True,
            review_required=False,
            reason="High-confidence match has sufficient evidence and candidate separation",
        )


default_matching_thresholds = MatchingThresholds.from_settings()
