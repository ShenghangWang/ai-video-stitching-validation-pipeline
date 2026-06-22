"""Metadata helpers for job status, validation, and later processing output."""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from app.config import JobConfig
from app.errors import AppError


def write_metadata(path: str | Path, payload: dict[str, Any]) -> None:
    metadata_path = Path(path)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def success_metadata(job: JobConfig, *, started_at: float, warnings: list[str] | None = None) -> dict[str, Any]:
    ordered_clip_ids = _clip_ids_for_mode(job)
    payload: dict[str, Any] = {
        "job_id": job.job_id,
        "mode": job.mode,
        "status": "success",
        "stage": "config_validated",
        "input_clip_count": len(job.clips),
        "clip_order": ordered_clip_ids,
        "output_video_path": job.output.video_path,
        "processing_time_seconds": round(time.perf_counter() - started_at, 4),
        "warnings": warnings or [],
    }
    if job.ground_truth_order is not None:
        payload["ground_truth_order"] = job.ground_truth_order
    if job.mode == "shuffled_reorder_concat":
        payload["predicted_order"] = None
        payload["transition_scores"] = []
        payload["confidence_score"] = None
    return payload


def failure_metadata(
    *,
    job: JobConfig | None,
    error: AppError,
    started_at: float,
    warnings: list[str] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "status": "failed",
        "error": error.to_metadata(),
        "processing_time_seconds": round(time.perf_counter() - started_at, 4),
        "warnings": warnings or [],
    }
    if job is not None:
        payload.update(
            {
                "job_id": job.job_id,
                "mode": job.mode,
                "input_clip_count": len(job.clips),
                "output_video_path": job.output.video_path,
            }
        )
    return payload


def _clip_ids_for_mode(job: JobConfig) -> list[str]:
    if job.mode in {"ordered_concat", "timeline_assembly"}:
        return [clip.clip_id for clip in sorted(job.clips, key=lambda clip: clip.order or 0)]
    return [clip.clip_id for clip in job.clips]

