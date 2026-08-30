import logging

from rapidfuzz import fuzz

from app.core.config import settings
from app.models.schemas import (
    MatchCandidate,
    MatchProposalPayload,
    MatchTierEnum,
    NormalizedObservation,
    ScheduleActivity,
)
from app.services.embeddings import compute_embeddings, cosine_similarity

logger = logging.getLogger(__name__)

# =============================================================================
# Quantity Plausibility Scoring
# =============================================================================

def _quantity_plausibility_signal(
    obs_quantity: float | None,
    obs_unit: str | None,
    act_quantity: float | None,
    act_unit: str | None,
) -> float:
    """
    Returns a small boost or penalty based on whether the reported quantity
    is plausible relative to the planned activity quantity.

    Returns:
        +0.03 if reported quantity is within a reasonable range of planned.
        -0.03 if reported quantity is wildly off (10x or more).
         0.0  if data is insufficient to judge.
    """
    if obs_quantity is None or act_quantity is None:
        return 0.0
    if act_quantity <= 0:
        return 0.0

    # Simple unit compatibility check — only compare if units are present and vaguely match
    if obs_unit and act_unit:
        obs_u = obs_unit.lower().replace(".", "").replace("-", "").replace(" ", "")
        act_u = act_unit.lower().replace(".", "").replace("-", "").replace(" ", "")
        # If units are clearly different classes, skip
        unit_families = [
            {"cum", "cubicmeter", "cubicmetre", "cubicmeters"},
            {"mt", "metricton", "metrictonne", "tonnes", "ton"},
            {"m", "meters", "metre", "meter", "rm", "runningmeter"},
            {"inchdia", "id"},
            {"nos", "numbers", "units", "unit", "tag", "tags"},
            {"sqm", "squaremeter", "squaremetre"},
        ]
        obs_family = None
        act_family = None
        for family in unit_families:
            if obs_u in family:
                obs_family = family
            if act_u in family:
                act_family = family
        if obs_family and act_family and obs_family != act_family:
            return 0.0  # Different unit families — can't compare

    ratio = obs_quantity / act_quantity
    if 0.01 <= ratio <= 1.5:
        return 0.03  # Plausible — small boost
    elif ratio > 10.0 or ratio < 0.001:
        return -0.03  # Wildly off — small penalty
    return 0.0


class HybridMatcher:
    """
    Combines Lexical (RapidFuzz), Semantic Vector Similarity (384-dim),
    and Contextual Boosting to match field observations to L5/L6 activities.

    Features:
    - Hybrid confidence scoring (lexical + semantic + context)
    - Quantity plausibility signals
    - Deterministic tie-breaking rules
    - Batch embedding pre-computation
    - Near-duplicate observation deduplication
    """

    @classmethod
    def match_observation(
        cls, observation: NormalizedObservation, activities: list[ScheduleActivity], top_k: int = 3
    ) -> MatchProposalPayload:
        if not activities:
            return MatchProposalPayload(
                observation=observation, candidates=[], top_match=None, auto_link_eligible=False
            )

        # 1. Generate observation embedding
        obs_text_for_embedding = (
            f"{observation.normalized_text} {observation.discipline or ''} {observation.equipment_tag or ''}"
        )
        obs_embedding = compute_embeddings([obs_text_for_embedding])[0]

        # 2. Batch pre-compute activity embeddings for any that don't already have one
        cls._ensure_activity_embeddings(activities)

        scored_candidates: list[MatchCandidate] = []

        for act in activities:
            # 3. Lexical scoring
            lex_score_set = fuzz.token_set_ratio(observation.normalized_text.lower(), act.name.lower()) / 100.0
            lex_score_sort = fuzz.token_sort_ratio(observation.normalized_text.lower(), act.name.lower()) / 100.0
            lex_score_desc = (
                fuzz.token_set_ratio(observation.normalized_text.lower(), (act.description or "").lower()) / 100.0
            )
            lex_score_code = fuzz.partial_ratio(observation.normalized_text.lower(), act.code.lower()) / 100.0

            # Check exact code or equipment tag mention
            raw_lower = observation.raw_text.lower()
            norm_lower = observation.normalized_text.lower()
            act_tag_clean = (
                (act.equipment_tag or "").lower().replace("line-", "").replace("pump-", "").replace("fnd-", "")
            )
            obs_tag_clean = (
                (observation.equipment_tag or "").lower().replace("line-", "").replace("pump-", "").replace("fnd-", "")
            )

            has_code_match = act.code.lower() in raw_lower or act.code.lower() in norm_lower
            has_tag_match = bool(
                act_tag_clean
                and (
                    act_tag_clean in raw_lower
                    or act_tag_clean in norm_lower
                    or (obs_tag_clean and act_tag_clean == obs_tag_clean)
                )
            )

            if has_code_match or has_tag_match:
                lexical_score = 1.0
            else:
                lexical_score = max(lex_score_set, lex_score_sort, lex_score_desc * 0.9, lex_score_code * 0.85)

            # 4. Semantic vector scoring
            act_embedding = act.embedding
            if not act_embedding:
                # Fallback — should have been pre-computed, but handle edge case
                act_text = f"{act.code} {act.name} {act.description or ''} {act.equipment_tag or ''}"
                act_embedding = compute_embeddings([act_text])[0]
                act.embedding = act_embedding

            semantic_score = cosine_similarity(obs_embedding, act_embedding)

            # 5. Contextual score boost
            context_boost = 0.0
            # Discipline match (+0.10)
            if observation.discipline and observation.discipline == act.discipline:
                context_boost += 0.10
            # Equipment tag match (+0.15)
            if has_tag_match:
                context_boost += 0.15
            # Location/zone match (+0.05)
            if observation.location and act.location and observation.location.lower() in act.location.lower():
                context_boost += 0.05

            context_boost = min(context_boost, 0.30)

            # 6. Quantity plausibility signal
            qty_signal = _quantity_plausibility_signal(
                observation.reported_quantity,
                observation.unit_of_measure,
                act.planned_quantity,
                act.unit_of_measure,
            )

            # 7. Combined Hybrid Confidence Score
            w_lex = settings.WEIGHT_LEXICAL
            w_sem = settings.WEIGHT_SEMANTIC
            w_ctx = settings.WEIGHT_CONTEXT

            # If lexical match is very strong (>= 0.95), weight it higher
            if lexical_score >= 0.95:
                combined_score = 0.70 * lexical_score + 0.20 * semantic_score + 0.10 * (context_boost / 0.30)
            else:
                combined_score = (w_lex * lexical_score) + (w_sem * semantic_score) + (w_ctx * (context_boost / 0.30))

            # Apply quantity plausibility
            combined_score += qty_signal

            combined_score = min(1.0, max(0.0, combined_score))

            # 8. Determine Match Tier
            if combined_score >= settings.MATCH_HIGH_CONFIDENCE_THRESHOLD:
                match_tier = MatchTierEnum.HIGH
            elif combined_score >= settings.MATCH_REVIEW_THRESHOLD:
                match_tier = MatchTierEnum.MEDIUM
            elif combined_score >= 0.35:
                match_tier = MatchTierEnum.LOW
            else:
                match_tier = MatchTierEnum.UNMATCHED

            # 9. Explanation & Evidence Snippet
            explanation = (
                f"Confidence {combined_score * 100:.1f}%: "
                f"Lexical={lexical_score * 100:.0f}%, "
                f"Semantic={semantic_score * 100:.0f}%, "
                f"Context boost={context_boost * 100:.0f}%"
            )
            if qty_signal != 0.0:
                explanation += f", Qty signal={'+' if qty_signal > 0 else ''}{qty_signal * 100:.0f}%"

            evidence_snippet = f'Obs: "{observation.raw_text}" -> Activity [{act.code}] "{act.name}"'

            candidate = MatchCandidate(
                activity_id=act.id,
                activity_code=act.code,
                activity_name=act.name,
                candidate_rank=1,
                lexical_score=round(lexical_score, 4),
                semantic_score=round(semantic_score, 4),
                context_boost=round(context_boost, 4),
                confidence_score=round(combined_score, 4),
                match_tier=match_tier,
                explanation=explanation,
                evidence_snippet=evidence_snippet,
            )
            scored_candidates.append(candidate)

        # 10. Sort candidates with deterministic tie-breaking
        scored_candidates.sort(key=lambda c: cls._sort_key(c, observation), reverse=True)

        # Assign ranks
        for rank, cand in enumerate(scored_candidates[:top_k], start=1):
            cand.candidate_rank = rank

        top_candidates = scored_candidates[:top_k]
        top_match = (
            top_candidates[0] if top_candidates and top_candidates[0].match_tier != MatchTierEnum.UNMATCHED else None
        )

        # Auto-link eligibility: High confidence and clear separation from 2nd candidate
        auto_link_eligible = False
        if top_match and top_match.match_tier == MatchTierEnum.HIGH:
            if len(top_candidates) > 1:
                # If gap is > 0.08, auto-link; otherwise route to review to resolve ambiguity
                score_gap = top_match.confidence_score - top_candidates[1].confidence_score
                auto_link_eligible = score_gap >= 0.08
            else:
                auto_link_eligible = True

        return MatchProposalPayload(
            observation=observation,
            candidates=top_candidates,
            top_match=top_match,
            auto_link_eligible=auto_link_eligible,
        )

    # =========================================================================
    # Deterministic Tie-Breaking
    # =========================================================================

    @classmethod
    def _sort_key(cls, candidate: MatchCandidate, observation: NormalizedObservation) -> tuple:
        """
        Build a deterministic sort key for candidates. When confidence_score is
        equal to 4 decimal places, we break ties in this order:
          1. Higher lexical score wins.
          2. Higher semantic score wins.
          3. Discipline-matching candidate wins.
          4. Activity code sorted lexicographically ascending (lower code wins).
        """
        discipline_match = 1 if (
            observation.discipline
            and candidate.activity_code  # just need a signal; we use discipline from the explanation
        ) else 0

        # We can't directly compare discipline from MatchCandidate (it's not stored),
        # so we use a heuristic: if the candidate's activity_code prefix matches
        # the discipline's common prefix, it's a discipline match.
        disc_prefix_map = {
            "PIPING": "PIP",
            "CIVIL": "CIV",
            "MECHANICAL": "MEC",
            "ELECTRICAL": "ELE",
            "INSTRUMENTATION": "INS",
            "HSE": "HSE",
        }
        if observation.discipline:
            expected_prefix = disc_prefix_map.get(observation.discipline.value, "")
            discipline_match = 1 if candidate.activity_code.startswith(expected_prefix) else 0

        return (
            candidate.confidence_score,
            candidate.lexical_score,
            candidate.semantic_score,
            discipline_match,
            # Invert code so that ascending code wins (smaller code = larger sort key)
            tuple(-ord(c) for c in candidate.activity_code),
        )

    # =========================================================================
    # Batch Embedding Pre-computation
    # =========================================================================

    @classmethod
    def _ensure_activity_embeddings(cls, activities: list[ScheduleActivity]) -> None:
        """
        Pre-compute embeddings for all activities that don't have one yet,
        in a single batch call. This avoids calling the embedding model N times
        per observation when processing a list of activities.
        """
        texts_to_embed: list[str] = []
        indices_to_fill: list[int] = []

        for i, act in enumerate(activities):
            if not act.embedding:
                act_text = f"{act.code} {act.name} {act.description or ''} {act.equipment_tag or ''}"
                texts_to_embed.append(act_text)
                indices_to_fill.append(i)

        if texts_to_embed:
            embeddings = compute_embeddings(texts_to_embed)
            for idx, emb in zip(indices_to_fill, embeddings, strict=False):
                activities[idx].embedding = emb

    # =========================================================================
    # Near-Duplicate Observation Deduplication
    # =========================================================================

    @classmethod
    def deduplicate_observations(
        cls, observations: list[NormalizedObservation], threshold: float = 0.92
    ) -> list[NormalizedObservation]:
        """
        Detect near-duplicate observations using normalized text similarity
        (RapidFuzz token_sort_ratio >= threshold). Keeps the observation with
        the highest extraction confidence from each cluster.

        Returns a deduplicated list.
        """
        if len(observations) <= 1:
            return observations

        # Track which observations have been merged into another
        merged: set[int] = set()
        result: list[NormalizedObservation] = []

        for i, obs_a in enumerate(observations):
            if i in merged:
                continue

            best = obs_a
            for j in range(i + 1, len(observations)):
                if j in merged:
                    continue
                obs_b = observations[j]

                similarity = fuzz.token_sort_ratio(
                    obs_a.normalized_text.lower(),
                    obs_b.normalized_text.lower(),
                ) / 100.0

                if similarity >= threshold:
                    merged.add(j)
                    # Keep the one with higher extraction confidence
                    if obs_b.extraction_confidence > best.extraction_confidence:
                        best = obs_b

            result.append(best)

        if len(observations) != len(result):
            logger.info(
                f"Deduplicated {len(observations)} observations down to {len(result)} "
                f"(removed {len(observations) - len(result)} near-duplicates)"
            )

        return result
