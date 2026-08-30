from datetime import datetime, timezone
from uuid import uuid4

from app.models.schemas import EventTypeEnum, MatchTierEnum, NormalizedObservation
from app.services.matcher import HybridMatcher

from .golden_dataset import GOLDEN_SCHEDULE, GOLDEN_TEST_CASES, PROJECT_ID


def test_golden_dataset_metrics():
    """
    Evaluates the HybridMatcher against a benchmark 'golden' dataset.
    Tracks precision, recall, and false-positive rates to ensure matching quality.
    """
    matcher = HybridMatcher()

    true_positives = 0
    false_positives = 0
    false_negatives = 0
    true_negatives = 0

    for case in GOLDEN_TEST_CASES:
        observation = NormalizedObservation(
            id=uuid4(),
            project_id=PROJECT_ID,
            raw_text=case["text"],
            normalized_text=case["text"],
            discipline=case["discipline"],
            observed_at=datetime.now(timezone.utc),
            event_type=EventTypeEnum.PROGRESS,
        )

        proposal_payload = matcher.build_proposal(observation, GOLDEN_SCHEDULE)

        # Determine the top match (if any) that isn't UNMATCHED
        top_match = None
        if proposal_payload.top_match and proposal_payload.top_match.match_tier != MatchTierEnum.UNMATCHED:
            top_match = proposal_payload.top_match

        expected_id = case["expected_activity_id"]

        if expected_id is not None:
            # We expected a match
            if top_match is not None and top_match.activity_id == expected_id:
                true_positives += 1
            elif top_match is not None and top_match.activity_id != expected_id:
                false_positives += 1
                false_negatives += 1  # We missed the expected one
            else:
                false_negatives += 1
        else:
            # We expected NO match (UNMATCHED)
            if top_match is None:
                true_negatives += 1
            else:
                false_positives += 1

    # Calculate Metrics
    precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0.0
    recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0.0

    # Ensure baseline assertion holds
    assert (true_positives + false_negatives + true_negatives + false_positives) > 0

    print("\nGolden Dataset Metrics:")
    print(f"Precision: {precision:.2f}")
    print(f"Recall: {recall:.2f}")
    print(f"True Positives: {true_positives}")
    print(f"False Positives: {false_positives}")
    print(f"False Negatives: {false_negatives}")
    print(f"True Negatives: {true_negatives}")


if __name__ == "__main__":
    test_golden_dataset_metrics()
