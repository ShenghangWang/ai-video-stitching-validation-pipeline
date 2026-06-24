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

Latest result:

```text
Docker image built successfully
```

The Dockerfile now switches Debian package sources to HTTPS and uses apt acquire retries before installing FFmpeg. This fixed the transient `deb.debian.org:http` download failure seen during the previous acceptance attempt.

Runtime dependency checks:

```bash
docker run --rm ai-video-stitcher python -m app.runtime
docker run --rm ai-video-stitcher ffmpeg -version
docker run --rm ai-video-stitcher ffprobe -version
```

Latest result:

```text
status ok with FFmpeg and FFprobe available
```

Docker workflow smoke checks:

```bash
python scripts/make_test_clips.py \
  --source source_english_outdoors_complete.mp4 \
  --output-dir input/generated_clips \
  --clip-length 3 \
  --shuffle true \
  --seed 123 \
  --max-clips 3

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

Latest ordered concat result:

```json
{
  "status": "success",
  "stage": "video_stitched",
  "clip_order": ["clip_001", "clip_002", "clip_003"],
  "clip_count": 3,
  "output_exists": true,
  "normalized_count": 3
}
```

Latest shuffled reorder result:

```json
{
  "status": "success",
  "stage": "video_stitched",
  "predicted_order": ["clip_001", "clip_002", "clip_003"],
  "ground_truth_order": ["clip_001", "clip_002", "clip_003"],
  "confidence_score": 0.744765,
  "evaluation": {
    "adjacency_accuracy": 1.0,
    "exact_order_match": true,
    "position_accuracy": 1.0
  },
  "transition_score_count": 6,
  "output_exists": true
}
```

Silent-audio normalization check:

```text
No-audio input normalized and stitched successfully; output audio stream is AAC, 48000 Hz, stereo.
```

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

## Known Limitations

- Shuffled ordering is explainable and measurable, but not guaranteed perfect.
- Hard cuts only.
- No production queue, API, storage integration, authentication, or UI.
- No GPU dependency.
