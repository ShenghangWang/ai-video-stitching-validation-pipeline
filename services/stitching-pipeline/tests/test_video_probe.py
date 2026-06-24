from __future__ import annotations

from unittest.mock import Mock, patch

import pytest

from app.config import ClipConfig
from app.video_probe import VideoProbeError, collect_available_clip_metadata, parse_ffprobe_output, probe_clip


def sample_ffprobe_output() -> dict:
    return {
        "streams": [
            {
                "codec_type": "video",
                "codec_name": "h264",
                "width": 1920,
                "height": 1080,
                "avg_frame_rate": "30000/1001",
                "duration": "5.005",
            },
            {
                "codec_type": "audio",
                "codec_name": "aac",
            },
        ],
        "format": {
            "duration": "5.1234",
        },
    }


def test_parse_ffprobe_output_extracts_video_and_audio_metadata() -> None:
    metadata = parse_ffprobe_output("clip_001", "/tmp/clip.mp4", sample_ffprobe_output())

    assert metadata.to_metadata() == {
        "clip_id": "clip_001",
        "path": "/tmp/clip.mp4",
        "duration_seconds": 5.123,
        "width": 1920,
        "height": 1080,
        "fps": 29.97,
        "video_codec": "h264",
        "audio_codec": "aac",
        "has_audio": True,
    }


def test_parse_ffprobe_output_handles_missing_audio() -> None:
    raw = sample_ffprobe_output()
    raw["streams"] = [raw["streams"][0]]

    metadata = parse_ffprobe_output("clip_001", "/tmp/clip.mp4", raw)

    assert metadata.has_audio is False
    assert metadata.audio_codec is None


def test_parse_ffprobe_output_requires_video_stream() -> None:
    raw = {"streams": [{"codec_type": "audio", "codec_name": "aac"}], "format": {}}

    with pytest.raises(VideoProbeError, match="video stream"):
        parse_ffprobe_output("clip_001", "/tmp/audio_only.mp4", raw)


def test_probe_clip_invokes_ffprobe_and_parses_json(tmp_path) -> None:
    clip_path = tmp_path / "clip.mp4"
    clip_path.write_bytes(b"placeholder")
    completed = Mock(returncode=0, stdout='{"streams":[{"codec_type":"video","codec_name":"h264"}],"format":{}}', stderr="")

    with patch("app.video_probe.subprocess.run", return_value=completed) as run:
        metadata = probe_clip(ClipConfig(clip_id="clip_001", path=str(clip_path)))

    assert metadata.clip_id == "clip_001"
    assert metadata.video_codec == "h264"
    assert run.call_args.args[0][:5] == ["ffprobe", "-v", "error", "-print_format", "json"]


def test_probe_clip_wraps_subprocess_os_errors(tmp_path) -> None:
    clip_path = tmp_path / "clip.mp4"
    clip_path.write_bytes(b"placeholder")

    with patch("app.video_probe.subprocess.run", side_effect=FileNotFoundError("ffprobe")):
        with pytest.raises(VideoProbeError, match="could not be executed"):
            probe_clip(ClipConfig(clip_id="clip_001", path=str(clip_path)))


def test_collect_available_clip_metadata_warns_when_files_are_missing() -> None:
    metadata, warnings = collect_available_clip_metadata(
        [
            ClipConfig(clip_id="missing_a", path="/tmp/missing_a.mp4"),
            ClipConfig(clip_id="missing_b", path="/tmp/missing_b.mp4"),
        ]
    )

    assert metadata == []
    assert "missing_a" in warnings[0]
    assert "missing_b" in warnings[0]


def test_collect_available_clip_metadata_warns_when_ffprobe_is_missing(tmp_path) -> None:
    clip_path = tmp_path / "clip.mp4"
    clip_path.write_bytes(b"placeholder")

    with patch("app.video_probe.shutil.which", return_value=None):
        metadata, warnings = collect_available_clip_metadata([ClipConfig(clip_id="clip_001", path=str(clip_path))])

    assert metadata == []
    assert "ffprobe" in warnings[0]
