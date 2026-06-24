"""Ground-truth evaluation metrics for predicted clip order."""

from __future__ import annotations


def evaluate_order(predicted_order: list[str], ground_truth_order: list[str]) -> dict:
    if not ground_truth_order:
        return {
            "exact_order_match": False,
            "position_accuracy": 0.0,
            "adjacency_accuracy": 0.0,
        }

    exact = predicted_order == ground_truth_order
    compared = min(len(predicted_order), len(ground_truth_order))
    correct_positions = sum(
        1 for index in range(compared) if predicted_order[index] == ground_truth_order[index]
    )
    position_accuracy = correct_positions / len(ground_truth_order)

    truth_adjacencies = _adjacencies(ground_truth_order)
    if not truth_adjacencies:
        adjacency_accuracy = 1.0 if exact else 0.0
    else:
        predicted_adjacencies = _adjacencies(predicted_order)
        adjacency_accuracy = len(truth_adjacencies & predicted_adjacencies) / len(truth_adjacencies)

    return {
        "exact_order_match": exact,
        "position_accuracy": round(position_accuracy, 6),
        "adjacency_accuracy": round(adjacency_accuracy, 6),
    }


def _adjacencies(order: list[str]) -> set[tuple[str, str]]:
    return set(zip(order, order[1:]))
