"""FFprobe helpers for collecting input clip metadata."""

from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from typing import Any, Iterable

from app.config import ClipConfig
from app.errors import AppError


class VideoProbeError(AppError):
    """Raised when a clip cannot be inspected with FFprobe."""

    code = "video_probe_error"


@dataclass(frozen=True)
class ClipMetadata:
    clip_id: str
    path: str
    duration_seconds: float | None
    width: int | None
    height: int | None
    fps: float | None
    video_codec: str | None
    audio_codec: str | None
    has_audio: bool

    def to_metadata(self) -> dict[str, Any]:
        return {
            "clip_id": self.clip_id,
            "path": self.path,
            "duration_seconds": self.duration_seconds,
            "width": self.width,
            "height": self.height,
            "fps": self.fps,
            "video_codec": self.video_codec,
            "audio_codec": self.audio_codec,
            "has_audio": self.has_audio,
        }


def probe_clip(clip: ClipConfig, *, ffprobe_binary: str = "ffprobe") -> ClipMetadata:
    path = Path(clip.path)
    if not path.exists():
        raise VideoProbeError("Clip file does not exist.", details={"clip_id": clip.clip_id, "path": clip.path})

    command = [
        ffprobe_binary,
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(path),
    ]
    try:
        result = subprocess.run(command, check=False, capture_output=True, text=True)
    except OSError as exc:
        raise VideoProbeError(
            "FFprobe could not be executed.",
            details={"clip_id": clip.clip_id, "path": clip.path, "error": str(exc)},
        ) from exc
    if result.returncode != 0:
        raise VideoProbeError(
            "FFprobe failed to inspect clip.",
            details={
                "clip_id": clip.clip_id,
                "path": clip.path,
                "stderr": result.stderr.strip(),
            },
        )

    try:
        ffprobe_output = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise VideoProbeError(
            "FFprobe returned invalid JSON.",
            details={"clip_id": clip.clip_id, "path": clip.path},
        ) from exc

    return parse_ffprobe_output(clip.clip_id, clip.path, ffprobe_output)


def probe_clips(clips: Iterable[ClipConfig], *, ffprobe_binary: str = "ffprobe") -> list[ClipMetadata]:
    return [probe_clip(clip, ffprobe_binary=ffprobe_binary) for clip in clips]


def parse_ffprobe_output(clip_id: str, path: str, data: dict[str, Any]) -> ClipMetadata:
    streams = data.get("streams")
    if not isinstance(streams, list):
        raise VideoProbeError("FFprobe output is missing streams.", details={"clip_id": clip_id, "path": path})

    video_stream = _first_stream(streams, "video")
    if video_stream is None:
        raise VideoProbeError("Clip does not contain a video stream.", details={"clip_id": clip_id, "path": path})

    audio_stream = _first_stream(streams, "audio")
    duration = _duration(data, video_stream)

    return ClipMetadata(
        clip_id=clip_id,
        path=path,
        duration_seconds=duration,
        width=_optional_int(video_stream.get("width")),
        height=_optional_int(video_stream.get("height")),
        fps=_fps(video_stream),
        video_codec=_optional_str(video_stream.get("codec_name")),
        audio_codec=_optional_str(audio_stream.get("codec_name")) if audio_stream else None,
        has_audio=audio_stream is not None,
    )


def collect_available_clip_metadata(
    clips: Iterable[ClipConfig], *, ffprobe_binary: str = "ffprobe"
) -> tuple[list[dict[str, Any]], list[str]]:
    clip_list = list(clips)
    missing = [clip for clip in clip_list if not Path(clip.path).exists()]
    if missing:
        missing_ids = ", ".join(clip.clip_id for clip in missing)
        return [], [f"Skipped FFprobe metadata because clip files are not available yet: {missing_ids}."]

    if shutil.which(ffprobe_binary) is None:
        return [], [f"Skipped FFprobe metadata because {ffprobe_binary!r} is not available in this environment."]

    probed = probe_clips(clip_list, ffprobe_binary=ffprobe_binary)
    return [clip.to_metadata() for clip in probed], []


def _first_stream(streams: list[Any], codec_type: str) -> dict[str, Any] | None:
    for stream in streams:
        if isinstance(stream, dict) and stream.get("codec_type") == codec_type:
            return stream
    return None


def _duration(data: dict[str, Any], video_stream: dict[str, Any]) -> float | None:
    format_data = data.get("format") if isinstance(data.get("format"), dict) else {}
    return _optional_float(format_data.get("duration")) or _optional_float(video_stream.get("duration"))


def _fps(video_stream: dict[str, Any]) -> float | None:
    raw_rate = video_stream.get("avg_frame_rate") or video_stream.get("r_frame_rate")
    if not isinstance(raw_rate, str) or raw_rate in {"0/0", "N/A"}:
        return None
    try:
        fps = float(Fraction(raw_rate))
    except (ValueError, ZeroDivisionError):
        return None
    return round(fps, 3)


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return round(float(value), 3)
    except (TypeError, ValueError):
        return None


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _optional_str(value: Any) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None
