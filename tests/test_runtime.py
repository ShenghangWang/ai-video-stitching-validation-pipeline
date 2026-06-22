from __future__ import annotations

from unittest.mock import Mock, patch

import pytest

from app.errors import AppError
from app.runtime import check_runtime_dependencies, main


def test_check_runtime_dependencies_returns_versions() -> None:
    completed = Mock(returncode=0, stdout="ffmpeg version 6.1\nmore details", stderr="")

    with patch("app.runtime.shutil.which", return_value="/usr/bin/tool"), patch(
        "app.runtime.subprocess.run", return_value=completed
    ):
        versions = check_runtime_dependencies(("ffmpeg", "ffprobe"))

    assert versions == {
        "ffmpeg": "ffmpeg version 6.1",
        "ffprobe": "ffmpeg version 6.1",
    }


def test_check_runtime_dependencies_reports_missing_binaries() -> None:
    with patch("app.runtime.shutil.which", return_value=None):
        with pytest.raises(AppError) as exc_info:
            check_runtime_dependencies(("ffmpeg", "ffprobe"))

    assert exc_info.value.to_metadata()["details"]["missing_binaries"] == ["ffmpeg", "ffprobe"]


def test_runtime_main_returns_nonzero_for_missing_dependencies(capsys: pytest.CaptureFixture[str]) -> None:
    with patch("app.runtime.shutil.which", return_value=None):
        exit_code = main()

    captured = capsys.readouterr()
    assert exit_code == 1
    assert '"status": "failed"' in captured.out
