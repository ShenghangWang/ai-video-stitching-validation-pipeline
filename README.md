# AI Video Stitching Validation Pipeline

This repository contains the project specification, sample media, and Codex-executable build plan for a Dockerized backend video-stitching validation module.

The MVP goal is to prove a repeatable worker that can:

- normalize multiple clips into a consistent FFmpeg-compatible format
- concatenate clips in a known order
- infer the likely order of shuffled clips cut from the same source video
- export a final MP4
- write structured metadata for validation and debugging
- run reproducibly in Docker

## Repository Contents

- `AI Video Stitching Pipeline Specification.pdf` - uploaded source specification
- `docs/spec_integrity_review.md` - review of the specification and plan integrity
- `docs/executable_build_plan.md` - improved Codex execution plan
- `source_chinese_complete.mp4` - complete Chinese-language source video
- `source_english_indoors_complete.mp4` - complete English-language indoor source video
- `source_english_outdoors_complete.mp4` - complete English-language outdoor source video

## Current Status

Execution 2 implementation is in place. The repository now has the Python package skeleton, CLI entrypoint, JSON config validation, structured errors, metadata writing, example job configs, focused config tests, Docker runtime support, and reusable FFmpeg/FFprobe dependency checks.

The next implementation step is Execution 3 in `docs/executable_build_plan.md`: FFprobe clip metadata extraction.

## Intended Build Direction

The worker should be implemented as a Python CLI first:

```bash
python -m app.main --config /app/input/job.json --workdir /app/tmp --verbose
```

Local validation currently works with the example jobs:

```bash
python -m pytest
python -m app.main --config examples/ordered_job.json --workdir tmp --verbose
```

Docker should be the primary runtime:

```bash
docker build -t ai-video-stitcher .
docker run --rm ai-video-stitcher ffmpeg -version
docker run --rm ai-video-stitcher ffprobe -version
docker run --rm \
  -v "$(pwd)/input:/app/input" \
  -v "$(pwd)/output:/app/output" \
  ai-video-stitcher \
  python -m app.main --config /app/input/ordered_job.json --workdir /app/tmp --verbose
```

The image also supports a direct dependency check:

```bash
docker run --rm ai-video-stitcher python -m app.runtime
```

## Notes

The source PDF has a few formatting artifacts where spaces are missing from shell commands. The reviewed and corrected commands are captured in the build plan and should be used during implementation.
