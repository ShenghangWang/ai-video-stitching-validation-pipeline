"""Clip normalization using FFmpeg."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.config import ClipConfig
from app.ffmpeg_utils import run_ffmpeg
from app.video_probe import ClipMetadata


@dataclass(frozen=True)
class NormalizedClip:
    clip_id: str
    source_path: str
    output_path: str
    log_path: str
    ffmpeg_command: list[str]

    def to_metadata(self) -> dict[str, Any]:
        return {
            "clip_id": self.clip_id,
            "source_path": self.source_path,
            "output_path": self.output_path,
            "log_path": self.log_path,
            "ffmpeg_command": self.ffmpeg_command,
        }


def normalize_clip(
    clip: ClipConfig,
    clip_metadata: ClipMetadata,
    settings: dict[str, Any],
    workdir: str | Path,
    *,
    ffmpeg_binary: str = "ffmpeg",
) -> NormalizedClip:
    normalized_dir = Path(workdir) / "normalized"
    logs_dir = Path(workdir) / "logs"
    normalized_dir.mkdir(parents=True, exist_ok=True)
    logs_dir.mkdir(parents=True, exist_ok=True)

    output_path = normalized_dir / f"{_safe_name(clip.clip_id)}_normalized.mp4"
    log_path = logs_dir / f"{_safe_name(clip.clip_id)}_normalize_ffmpeg.log"
    command = build_normalize_command(
        clip,
        clip_metadata,
        settings,
        output_path,
        ffmpeg_binary=ffmpeg_binary,
    )
    run_ffmpeg(command, log_path=log_path)

    return NormalizedClip(
        clip_id=clip.clip_id,
        source_path=clip.path,
        output_path=str(output_path),
        log_path=str(log_path),
        ffmpeg_command=command,
    )


def normalize_clips(
    clips: list[ClipConfig],
    metadata_by_clip_id: dict[str, ClipMetadata],
    settings: dict[str, Any],
    workdir: str | Path,
    *,
    ffmpeg_binary: str = "ffmpeg",
) -> list[NormalizedClip]:
    return [
        normalize_clip(
            clip,
            metadata_by_clip_id[clip.clip_id],
            settings,
            workdir,
            ffmpeg_binary=ffmpeg_binary,
        )
        for clip in clips
    ]


def build_normalize_command(
    clip: ClipConfig,
    clip_metadata: ClipMetadata,
    settings: dict[str, Any],
    output_path: str | Path,
    *,
    ffmpeg_binary: str = "ffmpeg",
) -> list[str]:
    width, height = _resolution(settings.get("resolution", "1280x720"))
    fps = settings.get("fps", 30)
    video_codec = settings.get("video_codec", "libx264")
    audio_codec = settings.get("audio_codec", "aac")
    video_filter = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,"
        f"fps={fps},format=yuv420p"
    )

    command = [
        ffmpeg_binary,
        "-y",
        "-i",
        clip.path,
    ]

    if clip_metadata.has_audio:
        command.extend(
            [
                "-map",
                "0:v:0",
                "-map",
                "0:a:0",
                "-vf",
                video_filter,
                "-c:v",
                video_codec,
                "-preset",
                "fast",
                "-crf",
                "23",
                "-c:a",
                audio_codec,
                "-ar",
                "48000",
                "-ac",
                "2",
                str(output_path),
            ]
        )
        return command

    command.extend(
        [
            "-f",
            "lavfi",
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-shortest",
            "-vf",
            video_filter,
            "-c:v",
            video_codec,
            "-preset",
            "fast",
            "-crf",
            "23",
            "-c:a",
            audio_codec,
            "-ar",
            "48000",
            "-ac",
            "2",
            str(output_path),
        ]
    )
    return command


def _resolution(value: Any) -> tuple[int, int]:
    if not isinstance(value, str) or "x" not in value:
        raise ValueError("resolution must use WIDTHxHEIGHT format")
    width, height = value.lower().split("x", 1)
    return int(width), int(height)


def _safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", value).strip("._") or "clip"
