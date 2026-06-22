"""Recover clip order from pairwise transition scores."""

from __future__ import annotations

from dataclasses import dataclass
from itertools import permutations
from typing import Any


@dataclass(frozen=True)
class OrderSolution:
    predicted_order: list[str]
    total_score: float
    confidence_score: float
    method: str
    warnings: list[str]
    runner_up_score: float | None = None

    def to_metadata(self) -> dict[str, Any]:
        return {
            "predicted_order": self.predicted_order,
            "total_score": round(self.total_score, 6),
            "runner_up_score": round(self.runner_up_score, 6) if self.runner_up_score is not None else None,
            "confidence_score": self.confidence_score,
            "ordering_method": self.method,
            "ordering_warnings": self.warnings,
        }


def solve_order(clip_ids: list[str], transition_scores: list[dict[str, Any]]) -> OrderSolution:
    sorted_clip_ids = sorted(clip_ids)
    score_map = _score_map(transition_scores)

    if len(sorted_clip_ids) <= 1:
        return OrderSolution(sorted_clip_ids, 0.0, 1.0, "trivial", [], None)

    if len(sorted_clip_ids) <= 8:
        return _solve_bruteforce(sorted_clip_ids, score_map)
    return _solve_greedy(sorted_clip_ids, score_map)


def _solve_bruteforce(clip_ids: list[str], score_map: dict[tuple[str, str], float]) -> OrderSolution:
    best_order: tuple[str, ...] | None = None
    best_score = float("-inf")
    runner_up = float("-inf")
    tie_count = 0

    for order in permutations(clip_ids):
        score = _path_score(order, score_map)
        if score > best_score:
            runner_up = best_score
            best_score = score
            best_order = order
            tie_count = 0
        elif score == best_score:
            tie_count += 1
        elif score > runner_up:
            runner_up = score

    assert best_order is not None
    runner_up_score = None if runner_up == float("-inf") else runner_up
    confidence = _confidence(best_score, runner_up_score, len(clip_ids))
    warnings = _warnings(confidence, best_score, runner_up_score, tie_count)
    return OrderSolution(list(best_order), best_score, confidence, "bruteforce", warnings, runner_up_score)


def _solve_greedy(clip_ids: list[str], score_map: dict[tuple[str, str], float]) -> OrderSolution:
    unused = set(clip_ids)
    start = min(clip_ids, key=lambda clip_id: (_max_incoming(clip_id, clip_ids, score_map), clip_id))
    order = [start]
    unused.remove(start)

    while unused:
        current = order[-1]
        next_clip = max(sorted(unused), key=lambda clip_id: (_score(score_map, current, clip_id), _tie_break(clip_id)))
        order.append(next_clip)
        unused.remove(next_clip)

    total = _path_score(order, score_map)
    confidence = _confidence(total, None, len(clip_ids))
    warnings = ["Used greedy ordering because clip count exceeds brute-force limit."]
    warnings.extend(_warnings(confidence, total, None, 0))
    return OrderSolution(order, total, confidence, "greedy", warnings, None)


def _score_map(transition_scores: list[dict[str, Any]]) -> dict[tuple[str, str], float]:
    return {
        (str(item["from"]), str(item["to"])): float(item["score"])
        for item in transition_scores
        if item.get("from") != item.get("to")
    }


def _path_score(order: tuple[str, ...] | list[str], score_map: dict[tuple[str, str], float]) -> float:
    return sum(_score(score_map, left, right) for left, right in zip(order, order[1:]))


def _score(score_map: dict[tuple[str, str], float], left: str, right: str) -> float:
    return score_map.get((left, right), 0.0)


def _max_incoming(clip_id: str, clip_ids: list[str], score_map: dict[tuple[str, str], float]) -> float:
    return max((_score(score_map, other, clip_id) for other in clip_ids if other != clip_id), default=0.0)


def _confidence(total_score: float, runner_up_score: float | None, clip_count: int) -> float:
    edge_count = max(clip_count - 1, 1)
    average_score = max(0.0, min(1.0, total_score / edge_count))
    if runner_up_score is None:
        margin = 0.0
    else:
        margin = max(0.0, min(1.0, (total_score - runner_up_score) / edge_count))
    return round(max(0.0, min(1.0, (0.75 * average_score) + (0.25 * margin))), 6)


def _warnings(
    confidence: float, best_score: float, runner_up_score: float | None, tie_count: int
) -> list[str]:
    warnings = []
    if tie_count:
        warnings.append("Multiple orders had the same best transition score.")
    if runner_up_score is not None and best_score - runner_up_score < 0.05:
        warnings.append("Winning order has weak separation from runner-up.")
    if confidence < 0.6:
        warnings.append("Low confidence ordering result.")
    return warnings


def _tie_break(clip_id: str) -> tuple[int, str]:
    # max(..., key=...) should prefer lexicographically smaller IDs on score ties.
    return (-ord(clip_id[0]) if clip_id else 0, "".join(chr(255 - ord(char)) for char in clip_id))
