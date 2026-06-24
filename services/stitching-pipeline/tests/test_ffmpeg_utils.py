from __future__ import annotations

from unittest.mock import Mock, patch

import pytest

from app.ffmpeg_utils import FFmpegError, run_ffmpeg


def test_run_ffmpeg_captures_output_and_writes_log(tmp_path) -> None:
    completed = Mock(returncode=0, stdout="ok", stderr="details")
    log_path = tmp_path / "ffmpeg.log"

    with patch("app.ffmpeg_utils.shutil.which", return_value="/usr/bin/ffmpeg"), patch(
        "app.ffmpeg_utils.subprocess.run", return_value=completed
    ):
        result = run_ffmpeg(["ffmpeg", "-version"], log_path=log_path)

    assert result.returncode == 0
    assert result.stdout == "ok"
    assert log_path.exists()
    assert "COMMAND:" in log_path.read_text(encoding="utf-8")


def test_run_ffmpeg_raises_when_binary_is_missing() -> None:
    with patch("app.ffmpeg_utils.shutil.which", return_value=None):
        with pytest.raises(FFmpegError, match="not available"):
            run_ffmpeg(["ffmpeg", "-version"])


def test_run_ffmpeg_raises_on_failed_exit(tmp_path) -> None:
    completed = Mock(returncode=1, stdout="", stderr="bad input")

    with patch("app.ffmpeg_utils.shutil.which", return_value="/usr/bin/ffmpeg"), patch(
        "app.ffmpeg_utils.subprocess.run", return_value=completed
    ):
        with pytest.raises(FFmpegError, match="command failed"):
            run_ffmpeg(["ffmpeg", "-bad"], log_path=tmp_path / "ffmpeg.log")
