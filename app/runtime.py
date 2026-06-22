"""Runtime dependency checks for external video tools."""

from __future__ import annotations

import json
import shutil
import subprocess

from app.errors import AppError


REQUIRED_BINARIES = ("ffmpeg", "ffprobe")


class RuntimeDependencyError(AppError):
    """Raised when required external video tools are unavailable."""

    code = "runtime_dependency_error"


def check_runtime_dependencies(required_binaries: tuple[str, ...] = REQUIRED_BINARIES) -> dict[str, str]:
    versions: dict[str, str] = {}
    missing: list[str] = []

    for binary in required_binaries:
        if shutil.which(binary) is None:
            missing.append(binary)
            continue

        result = subprocess.run(
            [binary, "-version"],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeDependencyError(
                "Runtime dependency exists but cannot be executed.",
                details={"binary": binary, "stderr": result.stderr.strip()},
            )

        versions[binary] = _first_line(result.stdout)

    if missing:
        raise RuntimeDependencyError(
            "Required runtime dependencies are missing.",
            details={"missing_binaries": missing},
        )

    return versions


def _first_line(value: str) -> str:
    return next((line.strip() for line in value.splitlines() if line.strip()), "")


def main() -> int:
    try:
        versions = check_runtime_dependencies()
    except AppError as exc:
        print(json.dumps({"status": "failed", "error": exc.to_metadata()}, indent=2, sort_keys=True))
        return 1

    print(json.dumps({"status": "ok", "dependencies": versions}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
