from __future__ import annotations

from unittest.mock import Mock, patch

from app.config import ClipConfig
from app.normalizer import build_normalize_command, normalize_clip
from app.video_probe import ClipMetadata


def clip_metadata(*, has_audio: bool) -> ClipMetadata:
    return ClipMetadata(
        clip_id="clip_001",
        path="/input/clip.mp4",
        duration_seconds=5.0,
        width=1920,
        height=1080,
        fps=30.0,
        video_codec="h264",
        audio_codec="aac" if has_audio else None,
        has_audio=has_audio,
    )


def test_build_normalize_command_for_clip_with_audio() -> None:
    command = build_normalize_command(
        ClipConfig(clip_id="clip_001", path="/input/clip.mp4"),
        clip_metadata(has_audio=True),
        {"resolution": "1280x720", "fps": 30, "video_codec": "libx264", "audio_codec": "aac"},
        "/tmp/clip_normalized.mp4",
    )

    assert command[:4] == ["ffmpeg", "-y", "-i", "/input/clip.mp4"]
    assert "-map" in command
    assert "0:a:0" in command
    assert "anullsrc=channel_layout=stereo:sample_rate=48000" not in command
    assert "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p" in command
    assert command[-1] == "/tmp/clip_normalized.mp4"


def test_build_normalize_command_adds_silent_audio_for_clip_without_audio() -> None:
    command = build_normalize_command(
        ClipConfig(clip_id="clip_001", path="/input/clip.mp4"),
        clip_metadata(has_audio=False),
        {"resolution": "640x360", "fps": 24, "video_codec": "libx264", "audio_codec": "aac"},
        "/tmp/clip_normalized.mp4",
    )

    assert "-f" in command
    assert "lavfi" in command
    assert "anullsrc=channel_layout=stereo:sample_rate=48000" in command
    assert "1:a:0" in command
    assert "-shortest" in command
    assert "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p" in command


def test_normalize_clip_creates_deterministic_paths_and_invokes_ffmpeg(tmp_path) -> None:
    completed = Mock(returncode=0, stdout="", stderr="done")
    clip = ClipConfig(clip_id="clip 001", path="/input/clip.mp4")

    with patch("app.ffmpeg_utils.shutil.which", return_value="/usr/bin/ffmpeg"), patch(
        "app.ffmpeg_utils.subprocess.run", return_value=completed
    ):
        normalized = normalize_clip(
            clip,
            clip_metadata(has_audio=True),
            {"resolution": "1280x720", "fps": 30, "video_codec": "libx264", "audio_codec": "aac"},
            tmp_path,
        )

    assert normalized.output_path.endswith("normalized/clip_001_normalized.mp4")
    assert normalized.log_path.endswith("logs/clip_001_normalize_ffmpeg.log")
    assert normalized.ffmpeg_command[0] == "ffmpeg"
