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
- `Chinese.mp4`, `English_Indoors.mp4`, `English_Outdoors.mp4` - sample media assets for future validation work

## Current Status

This is the planning and repository-bootstrap state. The implementation should proceed through the execution plan in `docs/executable_build_plan.md`.

## Intended Build Direction

The worker should be implemented as a Python CLI first:

```bash
python -m app.main --config /app/input/job.json --workdir /app/tmp --verbose
```

Docker should be the primary runtime:

```bash
docker build -t ai-video-stitcher .
docker run --rm \
  -v "$(pwd)/input:/app/input" \
  -v "$(pwd)/output:/app/output" \
  ai-video-stitcher \
  python -m app.main --config /app/input/ordered_job.json --workdir /app/tmp --verbose
```

## Notes

The source PDF has a few formatting artifacts where spaces are missing from shell commands. The reviewed and corrected commands are captured in the build plan and should be used during implementation.
