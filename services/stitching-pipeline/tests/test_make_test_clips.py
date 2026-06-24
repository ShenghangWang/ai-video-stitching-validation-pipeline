from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from app.ffmpeg_utils import FFmpegResult
from app.video_probe import ClipMetadata
from scripts.make_test_clips import generate_test_clips


def source_metadata(duration_seconds: float) -> ClipMetadata:
    return ClipMetadata(
        clip_id="source",
        path="/tmp/source.mp4",
        duration_seconds=duration_seconds,
        width=1920,
        height=1080,
        fps=30.0,
        video_codec="h264",
        audio_codec="aac",
        has_audio=True,
    )


def test_generate_test_clips_creates_jobs_and_manifest(tmp_path) -> None:
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")
    output_dir = tmp_path / "generated"

    with patch("scripts.make_test_clips.probe_clip", return_value=source_metadata(16.0)), patch(
        "scripts.make_test_clips.run_ffmpeg", return_value=FFmpegResult(["ffmpeg"], 0, "", "")
    ) as run:
        manifest = generate_test_clips(
            source=source,
            output_dir=output_dir,
            clip_length=5,
            shuffle=True,
            seed=7,
        )

    ordered_job = json.loads((output_dir / "ordered_job.json").read_text(encoding="utf-8"))
    shuffled_job = json.loads((output_dir / "shuffled_job.json").read_text(encoding="utf-8"))

    assert manifest["clip_count"] == 3
    assert manifest["ground_truth_order"] == ["clip_001", "clip_002", "clip_003"]
    assert ordered_job["clips"][0]["order"] == 1
    assert ordered_job["ground_truth_order"] == ["clip_001", "clip_002", "clip_003"]
    assert shuffled_job["ground_truth_order"] == ["clip_001", "clip_002", "clip_003"]
    assert all("order" not in clip for clip in shuffled_job["clips"])
    assert run.call_count == 3
    assert run.call_args_list[0].args[0][0:2] == ["ffmpeg", "-y"]


def test_generate_test_clips_honors_max_clips(tmp_path) -> None:
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")

    with patch("scripts.make_test_clips.probe_clip", return_value=source_metadata(60.0)), patch(
        "scripts.make_test_clips.run_ffmpeg", return_value=FFmpegResult(["ffmpeg"], 0, "", "")
    ):
        manifest = generate_test_clips(
            source=source,
            output_dir=tmp_path / "generated",
            clip_length=5,
            max_clips=2,
        )

    assert manifest["clip_count"] == 2


def test_generate_test_clips_rejects_too_short_source(tmp_path) -> None:
    source = tmp_path / "source.mp4"
    source.write_bytes(b"video")

    with patch("scripts.make_test_clips.probe_clip", return_value=source_metadata(2.0)):
        with pytest.raises(ValueError, match="shorter"):
            generate_test_clips(source=source, output_dir=tmp_path / "generated", clip_length=5)
