"""Video stitching workflows."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.config import ClipConfig, JobConfig
from app.errors import AppError
from app.ffmpeg_utils import FFmpegResult, run_ffmpeg
from app.normalizer import NormalizedClip, normalize_clips
from app.video_probe import ClipMetadata, probe_clips


class ClipValidationError(AppError):
    """Raised when input clips cannot be used for processing."""

    code = "clip_validation_error"


@dataclass(frozen=True)
class OrderedConcatResult:
    clip_order: list[str]
    clip_metadata: list[ClipMetadata]
    normalized_clips: list[NormalizedClip]
    concat_file_path: str
    output_video_path: str
    ffmpeg_result: FFmpegResult

    def to_metadata(self) -> dict[str, Any]:
        return {
            "clip_order": self.clip_order,
            "clip_metadata": [clip.to_metadata() for clip in self.clip_metadata],
            "normalized_clips": [clip.to_metadata() for clip in self.normalized_clips],
            "concat_file_path": self.concat_file_path,
            "output_video_path": self.output_video_path,
            "concat_ffmpeg": self.ffmpeg_result.to_metadata(),
        }


def process_ordered_concat(job: JobConfig, workdir: str | Path, *, ffmpeg_binary: str = "ffmpeg") -> OrderedConcatResult:
    ordered_clips = ordered_job_clips(job)
    validate_clip_files(ordered_clips)

    clip_metadata = probe_clips(ordered_clips)
    metadata_by_clip_id = {metadata.clip_id: metadata for metadata in clip_metadata}
    normalized_clips = normalize_clips(
        ordered_clips,
        metadata_by_clip_id,
        job.settings,
        workdir,
        ffmpeg_binary=ffmpeg_binary,
    )
    concat_file_path = write_concat_file(normalized_clips, Path(workdir) / "concat.txt")
    ffmpeg_result = concatenate_normalized_clips(
        concat_file_path,
        job.output.video_path,
        workdir,
        ffmpeg_binary=ffmpeg_binary,
    )

    return OrderedConcatResult(
        clip_order=[clip.clip_id for clip in ordered_clips],
        clip_metadata=clip_metadata,
        normalized_clips=normalized_clips,
        concat_file_path=str(concat_file_path),
        output_video_path=job.output.video_path,
        ffmpeg_result=ffmpeg_result,
    )


def ordered_job_clips(job: JobConfig) -> list[ClipConfig]:
    return sorted(job.clips, key=lambda clip: clip.order or 0)


def validate_clip_files(clips: list[ClipConfig]) -> None:
    missing = [clip for clip in clips if not Path(clip.path).exists()]
    if missing:
        raise ClipValidationError(
            "One or more input clip files do not exist.",
            details={"missing_clips": [{"clip_id": clip.clip_id, "path": clip.path} for clip in missing]},
        )


def write_concat_file(normalized_clips: list[NormalizedClip], path: str | Path) -> Path:
    concat_path = Path(path)
    concat_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"file '{_escape_concat_path(clip.output_path)}'" for clip in normalized_clips]
    concat_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return concat_path


def concatenate_normalized_clips(
    concat_file_path: str | Path,
    output_video_path: str | Path,
    workdir: str | Path,
    *,
    ffmpeg_binary: str = "ffmpeg",
) -> FFmpegResult:
    output_path = Path(output_video_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    log_path = Path(workdir) / "logs" / "concat_ffmpeg.log"
    command = build_concat_command(concat_file_path, output_path, ffmpeg_binary=ffmpeg_binary)
    return run_ffmpeg(command, log_path=log_path)


def build_concat_command(
    concat_file_path: str | Path,
    output_video_path: str | Path,
    *,
    ffmpeg_binary: str = "ffmpeg",
) -> list[str]:
    return [
        ffmpeg_binary,
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_file_path),
        "-c",
        "copy",
        str(output_video_path),
    ]


def _escape_concat_path(path: str) -> str:
    return path.replace("'", "'\\''")
