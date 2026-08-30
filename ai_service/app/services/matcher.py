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


class HybridMatcher:
    """
    Combines Lexical (RapidFuzz), Semantic Vector Similarity (384-dim),
    and Contextual Boosting to match field observations to L5/L6 activities.
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

        scored_candidates: list[MatchCandidate] = []

        for act in activities:
            # 2. Lexical scoring
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

            # 3. Semantic vector scoring
            if act.embedding:
                act_embedding = act.embedding
            else:
                act_text = f"{act.code} {act.name} {act.description or ''} {act.equipment_tag or ''}"
                act_embedding = compute_embeddings([act_text])[0]
                act.embedding = act_embedding

            semantic_score = cosine_similarity(obs_embedding, act_embedding)

            # 4. Contextual score boost
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

            # 5. Combined Hybrid Confidence Score
            w_lex = settings.WEIGHT_LEXICAL
            w_sem = settings.WEIGHT_SEMANTIC
            w_ctx = settings.WEIGHT_CONTEXT

            # If lexical match is very strong (>= 0.95), weight it higher
            if lexical_score >= 0.95:
                combined_score = 0.70 * lexical_score + 0.20 * semantic_score + 0.10 * (context_boost / 0.30)
            else:
                combined_score = (w_lex * lexical_score) + (w_sem * semantic_score) + (w_ctx * (context_boost / 0.30))

            combined_score = min(1.0, max(0.0, combined_score))

            # 6. Determine Match Tier
            if combined_score >= settings.MATCH_HIGH_CONFIDENCE_THRESHOLD:
                match_tier = MatchTierEnum.HIGH
            elif combined_score >= settings.MATCH_REVIEW_THRESHOLD:
                match_tier = MatchTierEnum.MEDIUM
            elif combined_score >= 0.35:
                match_tier = MatchTierEnum.LOW
            else:
                match_tier = MatchTierEnum.UNMATCHED

            # 7. Explanation & Evidence Snippet
            explanation = (
                f"Confidence {combined_score * 100:.1f}%: "
                f"Lexical={lexical_score * 100:.0f}%, "
                f"Semantic={semantic_score * 100:.0f}%, "
                f"Context boost={context_boost * 100:.0f}%"
            )
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

        # Sort candidates descending by confidence score
        scored_candidates.sort(key=lambda c: c.confidence_score, reverse=True)

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
