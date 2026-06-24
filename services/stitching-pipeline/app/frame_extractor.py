"""Boundary frame extraction for shuffled clip ordering."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.config import ClipConfig
from app.errors import AppError
from app.ffmpeg_utils import run_ffmpeg


class FrameExtractionError(AppError):
    """Raised when boundary frames cannot be extracted."""

    code = "frame_extraction_error"


@dataclass(frozen=True)
class BoundaryFrames:
    clip_id: str
    first_frame_path: str
    last_frame_path: str
    method: str
    diagnostics: dict[str, Any]

    def to_metadata(self) -> dict[str, Any]:
        return {
            "clip_id": self.clip_id,
            "first_frame_path": self.first_frame_path,
            "last_frame_path": self.last_frame_path,
            "method": self.method,
            "diagnostics": self.diagnostics,
        }


def extract_boundary_frames(clip: ClipConfig, workdir: str | Path) -> BoundaryFrames:
    frames_dir = Path(workdir) / "frames" / _safe_name(clip.clip_id)
    frames_dir.mkdir(parents=True, exist_ok=True)
    first_path = frames_dir / "first.png"
    last_path = frames_dir / "last.png"

    try:
        return _extract_with_opencv(clip, first_path, last_path)
    except FrameExtractionError as opencv_error:
        fallback = _extract_with_ffmpeg(clip, first_path, last_path, opencv_error=opencv_error)
        return fallback


def extract_all_boundary_frames(clips: list[ClipConfig], workdir: str | Path) -> list[BoundaryFrames]:
    return [extract_boundary_frames(clip, workdir) for clip in clips]


def _extract_with_opencv(clip: ClipConfig, first_path: Path, last_path: Path) -> BoundaryFrames:
    try:
        import cv2  # type: ignore
    except ImportError as exc:
        raise FrameExtractionError("OpenCV is not available for frame extraction.") from exc

    capture = cv2.VideoCapture(clip.path)
    try:
        if not capture.isOpened():
            raise FrameExtractionError("OpenCV could not open clip.", details={"clip_id": clip.clip_id, "path": clip.path})

        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if frame_count <= 0:
            raise FrameExtractionError("OpenCV could not determine frame count.", details={"clip_id": clip.clip_id})

        capture.set(cv2.CAP_PROP_POS_FRAMES, 0)
        ok_first, first_frame = capture.read()
        capture.set(cv2.CAP_PROP_POS_FRAMES, max(frame_count - 1, 0))
        ok_last, last_frame = capture.read()

        if not ok_first or not ok_last:
            raise FrameExtractionError("OpenCV could not read boundary frames.", details={"clip_id": clip.clip_id})
        if not cv2.imwrite(str(first_path), first_frame) or not cv2.imwrite(str(last_path), last_frame):
            raise FrameExtractionError("OpenCV could not write boundary frames.", details={"clip_id": clip.clip_id})

        return BoundaryFrames(
            clip_id=clip.clip_id,
            first_frame_path=str(first_path),
            last_frame_path=str(last_path),
            method="opencv",
            diagnostics={"frame_count": frame_count},
        )
    finally:
        capture.release()


def _extract_with_ffmpeg(
    clip: ClipConfig,
    first_path: Path,
    last_path: Path,
    *,
    opencv_error: FrameExtractionError,
) -> BoundaryFrames:
    log_dir = first_path.parents[2] / "logs"
    first_command = [
        "ffmpeg",
        "-y",
        "-i",
        clip.path,
        "-frames:v",
        "1",
        str(first_path),
    ]
    last_command = [
        "ffmpeg",
        "-y",
        "-sseof",
        "-0.1",
        "-i",
        clip.path,
        "-frames:v",
        "1",
        "-update",
        "1",
        str(last_path),
    ]
    run_ffmpeg(first_command, log_path=log_dir / f"{_safe_name(clip.clip_id)}_first_frame_ffmpeg.log")
    run_ffmpeg(last_command, log_path=log_dir / f"{_safe_name(clip.clip_id)}_last_frame_ffmpeg.log")
    return BoundaryFrames(
        clip_id=clip.clip_id,
        first_frame_path=str(first_path),
        last_frame_path=str(last_path),
        method="ffmpeg",
        diagnostics={"opencv_error": opencv_error.to_metadata()},
    )


def _safe_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", value).strip("._") or "clip"
