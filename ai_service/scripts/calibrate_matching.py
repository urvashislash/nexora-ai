import argparse
import json
from pathlib import Path

from app.services.evaluation import evaluate_matching_dataset, recommend_thresholds


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate and calibrate NEXORA activity matching thresholds")
    parser.add_argument("dataset", type=Path)
    args = parser.parse_args()
    result = evaluate_matching_dataset(args.dataset)
    output = result.as_dict()
    output["recommended_thresholds"] = recommend_thresholds(result.records)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
