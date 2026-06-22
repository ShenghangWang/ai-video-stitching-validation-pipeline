from __future__ import annotations

from app.evaluator import evaluate_order
from app.order_solver import solve_order


def test_solve_order_uses_bruteforce_for_small_clip_sets() -> None:
    scores = [
        {"from": "a", "to": "b", "score": 0.9},
        {"from": "b", "to": "c", "score": 0.9},
        {"from": "a", "to": "c", "score": 0.1},
        {"from": "b", "to": "a", "score": 0.1},
        {"from": "c", "to": "a", "score": 0.1},
        {"from": "c", "to": "b", "score": 0.1},
    ]

    solution = solve_order(["c", "a", "b"], scores)

    assert solution.predicted_order == ["a", "b", "c"]
    assert solution.method == "bruteforce"
    assert solution.confidence_score > 0.6


def test_solve_order_emits_warnings_for_ties() -> None:
    scores = [
        {"from": "a", "to": "b", "score": 0.5},
        {"from": "b", "to": "a", "score": 0.5},
    ]

    solution = solve_order(["b", "a"], scores)

    assert "same best transition score" in " ".join(solution.warnings)


def test_solve_order_uses_greedy_for_large_clip_sets() -> None:
    clip_ids = [f"clip_{index}" for index in range(9)]
    scores = [
        {"from": f"clip_{index}", "to": f"clip_{index + 1}", "score": 0.9}
        for index in range(8)
    ]

    solution = solve_order(clip_ids, scores)

    assert solution.method == "greedy"
    assert solution.predicted_order[0] == "clip_0"
    assert "greedy" in " ".join(solution.warnings)


def test_evaluate_order_scores_exact_match() -> None:
    evaluation = evaluate_order(["a", "b", "c"], ["a", "b", "c"])

    assert evaluation == {
        "exact_order_match": True,
        "position_accuracy": 1.0,
        "adjacency_accuracy": 1.0,
    }


def test_evaluate_order_scores_partial_match() -> None:
    evaluation = evaluate_order(["a", "c", "b"], ["a", "b", "c"])

    assert evaluation["exact_order_match"] is False
    assert evaluation["position_accuracy"] == 0.333333
    assert evaluation["adjacency_accuracy"] == 0.0
