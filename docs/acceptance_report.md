# Acceptance Report

## Scope Completed

The repository now implements the planned MVP worker:

- Dockerized Python CLI structure
- JSON config validation
- structured success and failure metadata
- FFprobe clip metadata extraction
- FFmpeg normalization with silent-audio support
- ordered concatenation
- deterministic source-video clip generator
- boundary frame extraction with OpenCV and FFmpeg fallback
- histogram and perceptual-hash transition scoring
- brute-force and greedy shuffled order solving
- ground-truth evaluation metrics
- shuffled reorder and concat workflow
- explicit timeline assembly workflow

## Validation Performed

Unit tests:

```bash
python -m pytest
```

Latest result:

```text
53 passed
```

Docker build:

```bash
docker build -t ai-video-stitcher .
```

The final build verification was attempted during Execution 12. Docker Hub access succeeded after earlier transient TLS failures, and the build progressed into Debian package installation. The build then failed because `deb.debian.org` became unreachable while apt was downloading FFmpeg dependencies:

```text
Unable to connect to deb.debian.org:http
E: Unable to fetch some archives
```

The Dockerfile has been updated to use apt acquire retries, but the remaining blocker is network access to Debian package mirrors, not application code.

## Acceptance Criteria Mapping

- Docker image support: implemented through `Dockerfile`, `.dockerignore`, and `requirements.txt`.
- Ordered concat: implemented in `app.stitcher.process_ordered_concat`.
- Shuffled reorder concat: implemented in `app.stitcher.process_shuffled_reorder_concat`.
- Timeline assembly: implemented in `app.stitcher.process_timeline_assembly`.
- Clip normalization: implemented in `app.normalizer`.
- Silent audio support: implemented in no-audio normalization command path.
- FFprobe metadata: implemented in `app.video_probe`.
- Test clip generation: implemented in `scripts/make_test_clips.py`.
- Structured metadata: implemented in `app.metadata` and CLI workflows.
- Evaluation metrics: implemented in `app.evaluator`.

## Remaining Practical Checks

The next practical validation should run generated clip jobs against one of the included complete source videos inside Docker:

```bash
python scripts/make_test_clips.py \
  --source source_english_outdoors_complete.mp4 \
  --output-dir input/generated_clips \
  --clip-length 5 \
  --shuffle true \
  --seed 123

docker run --rm \
  -v "$(pwd):/workspace" \
  -w /workspace \
  ai-video-stitcher \
  python -m app.main --config input/generated_clips/ordered_job.json --workdir tmp --verbose

docker run --rm \
  -v "$(pwd):/workspace" \
  -w /workspace \
  ai-video-stitcher \
  python -m app.main --config input/generated_clips/shuffled_job.json --workdir tmp --verbose
```

## Known Limitations

- Shuffled ordering is explainable and measurable, but not guaranteed perfect.
- Hard cuts only.
- No production queue, API, storage integration, authentication, or UI.
- No GPU dependency.
