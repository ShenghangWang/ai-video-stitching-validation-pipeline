from __future__ import annotations

from unittest.mock import Mock, patch

import pytest

from app.config import ClipConfig, JobConfig, OutputConfig
from app.ffmpeg_utils import FFmpegResult
from app.normalizer import NormalizedClip
from app.stitcher import (
    ClipValidationError,
    build_concat_command,
    ordered_job_clips,
    process_ordered_concat,
    validate_clip_files,
    write_concat_file,
)
from app.video_probe import ClipMetadata


def make_job(clips: list[ClipConfig], output_video_path: str) -> JobConfig:
    return JobConfig(
        job_id="ordered_test",
        mode="ordered_concat",
        clips=clips,
        output=OutputConfig(video_path=output_video_path, metadata_path="output/metadata.json"),
        settings={"resolution": "1280x720", "fps": 30, "video_codec": "libx264", "audio_codec": "aac"},
    )


def clip_metadata(clip_id: str, path: str) -> ClipMetadata:
    return ClipMetadata(
        clip_id=clip_id,
        path=path,
        duration_seconds=5.0,
        width=1920,
        height=1080,
        fps=30.0,
        video_codec="h264",
        audio_codec="aac",
        has_audio=True,
    )


def test_ordered_job_clips_sorts_by_order() -> None:
    clips = [
        ClipConfig(clip_id="clip_b", path="/tmp/b.mp4", order=2),
        ClipConfig(clip_id="clip_a", path="/tmp/a.mp4", order=1),
    ]

    assert [clip.clip_id for clip in ordered_job_clips(make_job(clips, "output.mp4"))] == ["clip_a", "clip_b"]


def test_validate_clip_files_reports_missing_paths() -> None:
    with pytest.raises(ClipValidationError) as exc_info:
        validate_clip_files([ClipConfig(clip_id="missing", path="/tmp/does-not-exist.mp4", order=1)])

    assert exc_info.value.to_metadata()["details"]["missing_clips"][0]["clip_id"] == "missing"


def test_write_concat_file_uses_normalized_clip_paths(tmp_path) -> None:
    clips = [
        NormalizedClip("clip_001", "source.mp4", "/tmp/clip one.mp4", "log.txt", ["ffmpeg"]),
        NormalizedClip("clip_002", "source.mp4", "/tmp/clip'two.mp4", "log.txt", ["ffmpeg"]),
    ]

    concat_path = write_concat_file(clips, tmp_path / "concat.txt")

    assert concat_path.read_text(encoding="utf-8").splitlines() == [
        "file '/tmp/clip one.mp4'",
        "file '/tmp/clip'\\''two.mp4'",
    ]


def test_build_concat_command_uses_concat_demuxer() -> None:
    assert build_concat_command("/tmp/concat.txt", "/tmp/final.mp4") == [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "/tmp/concat.txt",
        "-c",
        "copy",
        "/tmp/final.mp4",
    ]


def test_process_ordered_concat_probes_normalizes_and_concatenates(tmp_path) -> None:
    clip_a = tmp_path / "a.mp4"
    clip_b = tmp_path / "b.mp4"
    clip_a.write_bytes(b"a")
    clip_b.write_bytes(b"b")
    clips = [
        ClipConfig(clip_id="clip_b", path=str(clip_b), order=2),
        ClipConfig(clip_id="clip_a", path=str(clip_a), order=1),
    ]
    job = make_job(clips, str(tmp_path / "final.mp4"))
    probed = [clip_metadata("clip_a", str(clip_a)), clip_metadata("clip_b", str(clip_b))]
    normalized = [
        NormalizedClip("clip_a", str(clip_a), str(tmp_path / "a_normalized.mp4"), "a.log", ["ffmpeg"]),
        NormalizedClip("clip_b", str(clip_b), str(tmp_path / "b_normalized.mp4"), "b.log", ["ffmpeg"]),
    ]
    ffmpeg_result = FFmpegResult(["ffmpeg"], 0, "", "", str(tmp_path / "logs" / "concat_ffmpeg.log"))

    with patch("app.stitcher.probe_clips", return_value=probed) as probe, patch(
        "app.stitcher.normalize_clips", return_value=normalized
    ) as normalize, patch("app.stitcher.run_ffmpeg", return_value=ffmpeg_result) as run:
        result = process_ordered_concat(job, tmp_path)

    assert result.clip_order == ["clip_a", "clip_b"]
    assert result.output_video_path == str(tmp_path / "final.mp4")
    assert result.concat_file_path == str(tmp_path / "concat.txt")
    assert probe.call_args.args[0][0].clip_id == "clip_a"
    assert normalize.call_args.args[0][0].clip_id == "clip_a"
    assert run.call_args.args[0][2:6] == ["-f", "concat", "-safe", "0"]


def test_process_ordered_concat_rejects_missing_input_before_probe(tmp_path) -> None:
    job = make_job([ClipConfig(clip_id="missing", path=str(tmp_path / "missing.mp4"), order=1)], "final.mp4")

    with patch("app.stitcher.probe_clips") as probe:
        with pytest.raises(ClipValidationError):
            process_ordered_concat(job, tmp_path)

    probe.assert_not_called()
