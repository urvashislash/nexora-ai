import json
import math
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from uuid import UUID, uuid5

from app.models.schemas import DisciplineEnum, MatchDecisionEnum, ScheduleActivity
from app.services.extractor import DocumentExtractor
from app.services.matcher import HybridMatcher
from app.services.matching_policy import MatchingThresholds


@dataclass(frozen=True)
class CalibrationRecord:
    confidence: float
    score_gap: float
    correct: bool


@dataclass(frozen=True)
class BenchmarkResult:
    cases: int
    matched_cases: int
    top1_accuracy: float
    overall_routing_accuracy: float
    auto_link_precision: float
    unsafe_auto_links: int
    review_required: int
    rejected: int
    records: tuple[CalibrationRecord, ...]

    def as_dict(self) -> dict:
        result = asdict(self)
        result["records"] = [asdict(record) for record in self.records]
        return result


def evaluate_matching_dataset(
    dataset_path: str | Path,
    *,
    thresholds: MatchingThresholds | None = None,
) -> BenchmarkResult:
    payload = json.loads(Path(dataset_path).read_text(encoding="utf-8"))
    project_id = UUID(payload["project_id"])
    activities = [
        ScheduleActivity(
            id=uuid5(project_id, row["code"]),
            project_id=project_id,
            code=row["code"],
            name=row["name"],
            description=row.get("description"),
            discipline=DisciplineEnum(row["discipline"]),
            location=row.get("location"),
            zone=row.get("zone"),
            equipment_tag=row.get("equipment_tag"),
            planned_start_date=date.fromisoformat(row.get("planned_start_date", "2026-08-01")),
            planned_finish_date=date.fromisoformat(row.get("planned_finish_date", "2026-09-30")),
            planned_quantity=row.get("planned_quantity"),
            unit_of_measure=row.get("unit_of_measure"),
        )
        for row in payload["activities"]
    ]

    records: list[CalibrationRecord] = []
    matched_correct = 0
    matched_cases = 0
    routed_correct = 0
    auto_total = 0
    auto_correct = 0
    unsafe_auto_links = 0
    review_required = 0
    rejected = 0

    for case in payload["observations"]:
        observations = DocumentExtractor.extract_from_text(case["text"], project_id)
        if len(observations) != 1:
            raise ValueError(f"Benchmark case {case['id']} must extract exactly one observation")
        proposal = HybridMatcher.match_observation(
            observations[0], activities, thresholds=thresholds
        )
        expected_code = case.get("expected_activity_code")
        predicted_code = proposal.top_match.activity_code if proposal.top_match else None
        top_correct = predicted_code == expected_code
        candidate_correct = expected_code is not None and bool(
            proposal.candidates and proposal.candidates[0].activity_code == expected_code
        )
        if expected_code is not None:
            matched_cases += 1
            matched_correct += int(top_correct)

        if proposal.decision == MatchDecisionEnum.AUTO_LINK:
            auto_total += 1
            auto_correct += int(top_correct)
            unsafe_auto_links += int(not top_correct)
        elif proposal.decision == MatchDecisionEnum.REVIEW_REQUIRED:
            review_required += 1
        else:
            rejected += 1

        route_correct = (
            top_correct
            if expected_code is not None
            else proposal.decision == MatchDecisionEnum.REJECTED
        )
        routed_correct += int(route_correct)
        raw_top = proposal.candidates[0] if proposal.candidates else None
        records.append(
            CalibrationRecord(
                confidence=raw_top.confidence_score if raw_top else 0.0,
                score_gap=proposal.score_gap or 0.0,
                correct=candidate_correct,
            )
        )

    total = len(payload["observations"])
    return BenchmarkResult(
        cases=total,
        matched_cases=matched_cases,
        top1_accuracy=matched_correct / matched_cases if matched_cases else 0.0,
        overall_routing_accuracy=routed_correct / total if total else 0.0,
        auto_link_precision=auto_correct / auto_total if auto_total else 1.0,
        unsafe_auto_links=unsafe_auto_links,
        review_required=review_required,
        rejected=rejected,
        records=tuple(records),
    )


def recommend_thresholds(
    records: tuple[CalibrationRecord, ...],
    *,
    target_auto_precision: float = 0.95,
    min_gap: float = 0.08,
) -> dict[str, float]:
    """Recommend conservative boundaries from labelled field outcomes without mutating runtime config."""
    if not records:
        raise ValueError("At least one calibration record is required")
    high = 0.95
    for candidate in (0.85, 0.88, 0.90, 0.92, 0.95):
        auto_records = [
            record for record in records if record.confidence >= candidate and record.score_gap >= min_gap
        ]
        if auto_records and sum(record.correct for record in auto_records) / len(auto_records) >= target_auto_precision:
            high = candidate
            break

    incorrect_scores = sorted(record.confidence for record in records if not record.correct)
    rejection = 0.40
    if incorrect_scores:
        rejection = max(
            0.40,
            min(0.45, math.ceil((max(incorrect_scores) + 0.05) * 20) / 20),
        )
    review = 0.60
    if incorrect_scores and max(incorrect_scores) >= review:
        review = max(rejection + 0.10, min(high - 0.10, round(max(incorrect_scores) + 0.05, 2)))
    return {
        "high_confidence": round(high, 2),
        "review": round(review, 2),
        "rejection": round(rejection, 2),
        "min_auto_link_gap": min_gap,
    }
