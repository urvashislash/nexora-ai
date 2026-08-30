import logging
import re
from datetime import timezone

from rapidfuzz import fuzz

from app.core.config import settings
from app.models.schemas import (
    MatchCandidate,
    MatchDecisionEnum,
    MatchProposalPayload,
    MatchTierEnum,
    NormalizedObservation,
    ScheduleActivity,
)
from app.services.embeddings import (
    build_activity_embedding_text,
    build_observation_embedding_text,
    compute_embeddings,
    cosine_similarity,
)
from app.services.matching_policy import MatchingThresholds, default_matching_thresholds
from app.services.normalizer import normalize_equipment_tag, normalize_unit_name

logger = logging.getLogger(__name__)


def _units_compatible(left: str | None, right: str | None) -> bool:
    if not left or not right:
        return True
    return normalize_unit_name(left) == normalize_unit_name(right)


def _quantity_plausibility_signal(
    obs_quantity: float | None,
    obs_unit: str | None,
    act_quantity: float | None,
    act_unit: str | None,
) -> float:
    if obs_quantity is None or act_quantity is None or act_quantity <= 0 or not _units_compatible(obs_unit, act_unit):
        return 0.0
    ratio = obs_quantity / act_quantity
    if 0.001 <= ratio <= 1.5:
        return 0.03
    if ratio > 10.0:
        return -0.04
    return 0.0


def _date_plausibility_signal(observation: NormalizedObservation, activity: ScheduleActivity) -> float:
    if observation.observed_at is None:
        return 0.0
    observed_date = observation.observed_at.astimezone(timezone.utc).date()
    if activity.planned_start_date <= observed_date <= activity.planned_finish_date:
        return 0.03
    distance = min(
        abs((observed_date - activity.planned_start_date).days),
        abs((observed_date - activity.planned_finish_date).days),
    )
    return 0.01 if distance <= 30 else (-0.02 if distance > 180 else 0.0)


class HybridMatcher:
    """Vector retrieval followed by lexical, semantic, and construction-context reranking."""

    @classmethod
    def match_observation(
        cls,
        observation: NormalizedObservation,
        activities: list[ScheduleActivity],
        top_k: int = 3,
        *,
        thresholds: MatchingThresholds | None = None,
    ) -> MatchProposalPayload:
        policy = thresholds or default_matching_thresholds
        if not activities:
            return MatchProposalPayload(
                observation=observation,
                candidates=[],
                top_match=None,
                auto_link_eligible=False,
                decision=MatchDecisionEnum.REJECTED,
                review_required=False,
                decision_reason="No schedule activities were supplied",
                policy_version=policy.version,
            )

        observation_embedding = compute_embeddings([build_observation_embedding_text(observation)])[0]
        cls._ensure_activity_embeddings(activities)
        retrieved = cls.retrieve_activities(observation, activities, observation_embedding)
        scored_candidates = [
            cls._score_candidate(observation, activity, observation_embedding, policy) for activity in retrieved
        ]
        scored_candidates.sort(key=cls._sort_key, reverse=True)
        top_candidates = scored_candidates[:top_k]
        for rank, candidate in enumerate(top_candidates, start=1):
            candidate.candidate_rank = rank

        raw_top = top_candidates[0] if top_candidates else None
        score_gap = None
        if raw_top is not None:
            score_gap = (
                raw_top.confidence_score - top_candidates[1].confidence_score
                if len(top_candidates) > 1
                else 1.0
            )
        decision = policy.decide(raw_top, observation, score_gap)
        top_match = raw_top if raw_top and raw_top.confidence_score >= policy.rejection else None

        return MatchProposalPayload(
            observation=observation,
            candidates=top_candidates,
            top_match=top_match,
            auto_link_eligible=decision.auto_link_eligible,
            decision=decision.decision,
            review_required=decision.review_required,
            decision_reason=decision.reason,
            score_gap=round(score_gap, 4) if score_gap is not None else None,
            policy_version=policy.version,
        )

    @classmethod
    def retrieve_activities(
        cls,
        observation: NormalizedObservation,
        activities: list[ScheduleActivity],
        observation_embedding: list[float] | None = None,
        limit: int | None = None,
    ) -> list[ScheduleActivity]:
        """Return vector-nearest activities plus exact context candidates so identifiers are never pruned."""
        if not activities:
            return []
        cls._ensure_activity_embeddings(activities)
        observation_embedding = observation_embedding or compute_embeddings(
            [build_observation_embedding_text(observation)]
        )[0]
        retrieval_limit = min(limit or settings.VECTOR_RETRIEVAL_LIMIT, len(activities))
        semantic_rank = sorted(
            activities,
            key=lambda activity: cosine_similarity(observation_embedding, activity.embedding or []),
            reverse=True,
        )
        selected = semantic_rank[:retrieval_limit]

        lexical_rank = sorted(
            activities,
            key=lambda activity: fuzz.token_set_ratio(
                observation.normalized_text.lower(),
                f"{activity.name} {activity.description or ''}".lower(),
            ),
            reverse=True,
        )[: min(10, len(activities))]

        raw_lower = observation.raw_text.lower()
        observation_tag = normalize_equipment_tag(observation.equipment_tag)
        selected_ids = {activity.id for activity in selected}
        for activity in lexical_rank:
            if activity.id not in selected_ids:
                selected.append(activity)
                selected_ids.add(activity.id)
        for activity in activities:
            activity_tag = normalize_equipment_tag(activity.equipment_tag)
            exact_context = (
                bool(re.search(rf"(?<!\w){re.escape(activity.code.lower())}(?!\w)", raw_lower))
                or bool(observation_tag and activity_tag and observation_tag == activity_tag)
            )
            if exact_context and activity.id not in selected_ids:
                selected.append(activity)
                selected_ids.add(activity.id)
        return selected

    @classmethod
    def _score_candidate(
        cls,
        observation: NormalizedObservation,
        activity: ScheduleActivity,
        observation_embedding: list[float],
        thresholds: MatchingThresholds,
    ) -> MatchCandidate:
        normalized_lower = observation.normalized_text.lower()
        raw_lower = observation.raw_text.lower()
        activity_text = " ".join(filter(None, (activity.name, activity.description or ""))).lower()

        lexical_scores = (
            fuzz.token_set_ratio(normalized_lower, activity.name.lower()) / 100.0,
            fuzz.token_sort_ratio(normalized_lower, activity.name.lower()) / 100.0,
            fuzz.token_set_ratio(normalized_lower, activity_text) / 100.0,
            fuzz.partial_ratio(normalized_lower, activity.code.lower()) / 100.0 * 0.85,
        )
        code_match = bool(
            re.search(rf"(?<!\w){re.escape(activity.code.lower())}(?!\w)", raw_lower)
            or re.search(rf"(?<!\w){re.escape(activity.code.lower())}(?!\w)", normalized_lower)
        )
        observation_tag = normalize_equipment_tag(observation.equipment_tag)
        activity_tag = normalize_equipment_tag(activity.equipment_tag)
        equipment_match = bool(observation_tag and activity_tag and observation_tag == activity_tag)
        lexical_score = 1.0 if code_match or equipment_match else max(lexical_scores)

        semantic_score = cosine_similarity(observation_embedding, activity.embedding or [])
        discipline_match = bool(observation.discipline and observation.discipline == activity.discipline)
        location_match = bool(
            observation.location
            and activity.location
            and (
                observation.location.lower() in activity.location.lower()
                or activity.location.lower() in observation.location.lower()
            )
        )
        zone_match = bool(
            observation.zone and activity.zone and observation.zone.casefold() == activity.zone.casefold()
        )

        context_boost = 0.0
        context_boost += 0.10 if discipline_match else 0.0
        context_boost += 0.15 if code_match else 0.0
        context_boost += 0.20 if equipment_match else 0.0
        context_boost += 0.05 if location_match else 0.0
        context_boost += 0.03 if zone_match else 0.0
        context_boost = min(context_boost, 0.35)

        if lexical_score >= 0.80 and context_boost >= 0.10:
            confidence = 0.55 * lexical_score + 0.25 * semantic_score + 0.20 * min(1.0, context_boost / 0.15)
        elif lexical_score >= 0.65 and context_boost >= 0.10:
            confidence = 0.50 * lexical_score + 0.35 * semantic_score + 0.15 * min(1.0, context_boost / 0.15)
        else:
            confidence = (
                settings.WEIGHT_LEXICAL * lexical_score
                + settings.WEIGHT_SEMANTIC * semantic_score
                + settings.WEIGHT_CONTEXT * min(1.0, context_boost / 0.15)
            )
        quantity_signal = _quantity_plausibility_signal(
            observation.reported_quantity,
            observation.unit_of_measure,
            activity.planned_quantity,
            activity.unit_of_measure,
        )
        date_signal = _date_plausibility_signal(observation, activity)
        identifier_signal = 0.03 if code_match else 0.0
        confidence = max(0.0, min(1.0, confidence + quantity_signal + date_signal + identifier_signal))

        if confidence >= thresholds.high_confidence:
            tier = MatchTierEnum.HIGH
        elif confidence >= thresholds.review:
            tier = MatchTierEnum.MEDIUM
        elif confidence >= thresholds.rejection:
            tier = MatchTierEnum.LOW
        else:
            tier = MatchTierEnum.UNMATCHED

        explanation = (
            f"Confidence {confidence * 100:.1f}%: lexical={lexical_score * 100:.0f}%, "
            f"semantic={semantic_score * 100:.0f}%, context={context_boost * 100:.0f}%, "
            f"quantity={quantity_signal * 100:+.0f}%, date={date_signal * 100:+.0f}%, "
            f"identifier={identifier_signal * 100:+.0f}%"
        )
        return MatchCandidate(
            activity_id=activity.id,
            activity_code=activity.code,
            activity_name=activity.name,
            lexical_score=round(lexical_score, 4),
            semantic_score=round(semantic_score, 4),
            context_boost=round(context_boost, 4),
            discipline_match=discipline_match,
            equipment_match=equipment_match,
            location_match=location_match,
            confidence_score=round(confidence, 4),
            match_tier=tier,
            explanation=explanation,
            evidence_snippet=f'Obs: "{observation.raw_text}" -> Activity [{activity.code}] "{activity.name}"',
        )

    @staticmethod
    def _sort_key(candidate: MatchCandidate) -> tuple:
        return (
            candidate.confidence_score,
            candidate.equipment_match,
            candidate.discipline_match,
            candidate.lexical_score,
            candidate.semantic_score,
            tuple(-ord(character) for character in candidate.activity_code),
        )

    @classmethod
    def _ensure_activity_embeddings(cls, activities: list[ScheduleActivity]) -> None:
        missing = [(index, activity) for index, activity in enumerate(activities) if not activity.embedding]
        if not missing:
            return
        embeddings = compute_embeddings([build_activity_embedding_text(activity) for _, activity in missing])
        for (index, _), embedding in zip(missing, embeddings, strict=False):
            activities[index].embedding = embedding

    @classmethod
    def deduplicate_observations(
        cls,
        observations: list[NormalizedObservation],
        threshold: float = 0.92,
    ) -> list[NormalizedObservation]:
        if len(observations) <= 1:
            return observations
        merged: set[int] = set()
        result: list[NormalizedObservation] = []
        for index, observation in enumerate(observations):
            if index in merged:
                continue
            best = observation
            for other_index in range(index + 1, len(observations)):
                if other_index in merged:
                    continue
                other = observations[other_index]
                similarity = fuzz.token_sort_ratio(
                    observation.normalized_text.lower(), other.normalized_text.lower()
                ) / 100.0
                if similarity >= threshold:
                    merged.add(other_index)
                    if other.extraction_confidence > best.extraction_confidence:
                        best = other
            result.append(best)
        return result
