"""Shared FFmpeg subprocess helpers."""

from __future__ import annotations

import shlex
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from app.errors import AppError


class FFmpegError(AppError):
    """Raised when FFmpeg cannot run or returns a failed exit code."""

    code = "ffmpeg_error"


@dataclass(frozen=True)
class FFmpegResult:
    command: list[str]
    returncode: int
    stdout: str
    stderr: str
    log_path: str | None = None

    def to_metadata(self) -> dict:
        return {
            "command": self.command,
            "returncode": self.returncode,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "log_path": self.log_path,
        }


def run_ffmpeg(command: list[str], *, log_path: str | Path | None = None) -> FFmpegResult:
    if not command:
        raise FFmpegError("FFmpeg command cannot be empty.")

    binary = command[0]
    if shutil.which(binary) is None:
        raise FFmpegError("FFmpeg binary is not available.", details={"binary": binary})

    try:
        completed = subprocess.run(command, check=False, capture_output=True, text=True)
    except OSError as exc:
        raise FFmpegError("FFmpeg could not be executed.", details={"binary": binary, "error": str(exc)}) from exc

    result = FFmpegResult(
        command=command,
        returncode=completed.returncode,
        stdout=completed.stdout,
        stderr=completed.stderr,
        log_path=str(log_path) if log_path is not None else None,
    )
    if log_path is not None:
        write_ffmpeg_log(log_path, result)

    if completed.returncode != 0:
        raise FFmpegError(
            "FFmpeg command failed.",
            details={
                "command": command,
                "returncode": completed.returncode,
                "stderr": completed.stderr.strip(),
                "log_path": str(log_path) if log_path is not None else None,
            },
        )

    return result


def write_ffmpeg_log(path: str | Path, result: FFmpegResult) -> None:
    log_path = Path(path)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(
        "\n".join(
            [
                "COMMAND:",
                shlex.join(result.command),
                "",
                "STDOUT:",
                result.stdout,
                "",
                "STDERR:",
                result.stderr,
                "",
            ]
        ),
        encoding="utf-8",
    )
