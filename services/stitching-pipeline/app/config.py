"""Configuration loading and validation."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.errors import ConfigError


SUPPORTED_MODES = {
    "ordered_concat",
    "shuffled_reorder_concat",
    "timeline_assembly",
}

DEFAULT_SETTINGS = {
    "resolution": "1280x720",
    "fps": 30,
    "video_codec": "libx264",
    "audio_codec": "aac",
    "transition": "cut",
}


@dataclass(frozen=True)
class ClipConfig:
    clip_id: str
    path: str
    order: int | None = None
    role: str | None = None


@dataclass(frozen=True)
class OutputConfig:
    video_path: str
    metadata_path: str


@dataclass(frozen=True)
class JobConfig:
    job_id: str
    mode: str
    clips: list[ClipConfig]
    output: OutputConfig
    settings: dict[str, Any] = field(default_factory=dict)
    ground_truth_order: list[str] | None = None
    raw: dict[str, Any] = field(default_factory=dict)


def load_config(path: str | Path) -> JobConfig:
    config_path = Path(path)
    if not config_path.exists():
        raise ConfigError("Config file does not exist.", details={"path": str(config_path)})

    try:
        raw = json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ConfigError(
            "Config file is not valid JSON.",
            details={"path": str(config_path), "line": exc.lineno, "column": exc.colno},
        ) from exc

    return parse_config(raw)


def parse_config(raw: dict[str, Any]) -> JobConfig:
    if not isinstance(raw, dict):
        raise ConfigError("Config root must be a JSON object.")

    job_id = _require_str(raw, "job_id")
    mode = _require_str(raw, "mode")
    if mode not in SUPPORTED_MODES:
        raise ConfigError(
            "Unsupported job mode.",
            details={"mode": mode, "supported_modes": sorted(SUPPORTED_MODES)},
        )

    clips = _parse_clips(raw.get("clips"), mode)
    output = _parse_output(raw.get("output"))
    settings = _parse_settings(raw.get("settings", {}))
    ground_truth_order = _parse_optional_str_list(raw.get("ground_truth_order"), "ground_truth_order")

    if ground_truth_order is not None:
        clip_ids = {clip.clip_id for clip in clips}
        missing = [clip_id for clip_id in ground_truth_order if clip_id not in clip_ids]
        if missing:
            raise ConfigError(
                "Ground truth order references unknown clip IDs.",
                details={"missing_clip_ids": missing},
            )

    return JobConfig(
        job_id=job_id,
        mode=mode,
        clips=clips,
        output=output,
        settings={**DEFAULT_SETTINGS, **settings},
        ground_truth_order=ground_truth_order,
        raw=raw,
    )


def _parse_clips(value: Any, mode: str) -> list[ClipConfig]:
    if not isinstance(value, list) or not value:
        raise ConfigError("Config field 'clips' must be a non-empty list.")

    clips: list[ClipConfig] = []
    seen_ids: set[str] = set()
    seen_orders: set[int] = set()

    for index, item in enumerate(value):
        if not isinstance(item, dict):
            raise ConfigError("Each clip must be a JSON object.", details={"index": index})

        clip_id = _require_str(item, "clip_id", context=f"clips[{index}]")
        if clip_id in seen_ids:
            raise ConfigError("Clip IDs must be unique.", details={"clip_id": clip_id})
        seen_ids.add(clip_id)

        path = _require_str(item, "path", context=f"clips[{index}]")
        order = _parse_optional_positive_int(item.get("order"), f"clips[{index}].order")
        role = _parse_optional_str(item.get("role"), f"clips[{index}].role")

        if mode in {"ordered_concat", "timeline_assembly"} and order is None:
            raise ConfigError(
                "Ordered modes require every clip to include a positive integer order.",
                details={"clip_id": clip_id, "mode": mode},
            )

        if order is not None:
            if order in seen_orders:
                raise ConfigError("Clip order values must be unique.", details={"order": order})
            seen_orders.add(order)

        clips.append(ClipConfig(clip_id=clip_id, path=path, order=order, role=role))

    if mode in {"ordered_concat", "timeline_assembly"}:
        expected = set(range(1, len(clips) + 1))
        if seen_orders != expected:
            raise ConfigError(
                "Ordered modes require contiguous order values starting at 1.",
                details={"expected": sorted(expected), "actual": sorted(seen_orders)},
            )

    return clips


def _parse_output(value: Any) -> OutputConfig:
    if not isinstance(value, dict):
        raise ConfigError("Config field 'output' must be a JSON object.")
    return OutputConfig(
        video_path=_require_str(value, "video_path", context="output"),
        metadata_path=_require_str(value, "metadata_path", context="output"),
    )


def _parse_settings(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ConfigError("Config field 'settings' must be a JSON object when provided.")

    settings = dict(value)
    resolution = settings.get("resolution")
    if resolution is not None:
        _validate_resolution(resolution)

    fps = settings.get("fps")
    if fps is not None:
        _validate_positive_number(fps, "settings.fps")

    transition = settings.get("transition")
    if transition is not None and transition != "cut":
        raise ConfigError(
            "Only hard cut transitions are supported for the MVP.",
            details={"transition": transition},
        )

    return settings


def _validate_resolution(value: Any) -> None:
    if not isinstance(value, str) or "x" not in value:
        raise ConfigError("settings.resolution must use WIDTHxHEIGHT format.")
    width, height = value.lower().split("x", 1)
    if not width.isdigit() or not height.isdigit() or int(width) <= 0 or int(height) <= 0:
        raise ConfigError("settings.resolution must contain positive integer dimensions.")


def _validate_positive_number(value: Any, field_name: str) -> None:
    if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
        raise ConfigError(f"{field_name} must be a positive number.")


def _require_str(data: dict[str, Any], key: str, *, context: str = "config") -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ConfigError(f"{context}.{key} must be a non-empty string.")
    return value


def _parse_optional_str(value: Any, field_name: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ConfigError(f"{field_name} must be a non-empty string when provided.")
    return value


def _parse_optional_str_list(value: Any, field_name: str) -> list[str] | None:
    if value is None:
        return None
    if not isinstance(value, list) or not all(isinstance(item, str) and item.strip() for item in value):
        raise ConfigError(f"{field_name} must be a list of non-empty strings when provided.")
    return value


def _parse_optional_positive_int(value: Any, field_name: str) -> int | None:
    if value is None:
        return None
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise ConfigError(f"{field_name} must be a positive integer when provided.")
    return value

