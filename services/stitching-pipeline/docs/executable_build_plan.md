# Codex-Executable Build Plan

This plan is organized as Codex executions, not calendar time. Each execution should produce a small, reviewable result with clear verification commands.

## Execution 0: Repository Audit And Bootstrap

Prompt:

```text
Inspect the current repository and compare it against the uploaded AI Video Stitching Pipeline Specification. Do not implement the worker yet. Confirm the repository structure, identify missing files, and produce or update README and planning docs only.
```

Deliverables:

- `README.md`
- `docs/spec_integrity_review.md`
- `docs/executable_build_plan.md`
- `.gitignore`

Verification:

```bash
git status --short
```

## Execution 1: Project Skeleton, CLI, And Config

Prompt:

```text
Create the Python project skeleton for the video stitching worker. Implement `python -m app.main --config ... --workdir ... --verbose`, JSON config loading, validation for supported modes, structured errors, and metadata writing for success and failure where possible. Add focused tests for config parsing and validation.
```

Deliverables:

- `app/__init__.py`
- `app/main.py`
- `app/config.py`
- `app/metadata.py`
- `app/errors.py`
- `tests/test_config.py`
- `examples/ordered_job.json`
- `examples/shuffled_job.json`
- `examples/timeline_job.json`

Verification:

```bash
python -m pytest
python -m app.main --config examples/ordered_job.json --workdir tmp --verbose
```

## Execution 2: Docker Runtime

Prompt:

```text
Add Docker support for the CLI worker. Use Python 3.11+, FFmpeg, FFprobe, OpenCV-compatible dependencies, and requirements.txt. Ensure the worker can run through mounted input/output folders. Update README with corrected Docker commands.
```

Deliverables:

- `Dockerfile`
- `requirements.txt`
- README Docker instructions
- startup check or utility for FFmpeg/FFprobe availability

Verification:

```bash
docker build -t ai-video-stitcher .
docker run --rm ai-video-stitcher ffmpeg -version
docker run --rm ai-video-stitcher ffprobe -version
```

## Execution 3: FFprobe Metadata

Prompt:

```text
Implement FFprobe-based probing. For each input clip, collect duration, width, height, fps, video codec, audio codec, and whether audio exists. Capture this in metadata. Add tests using mocked subprocess output.
```

Deliverables:

- `app/video_probe.py`
- probe result model or typed dictionary
- metadata integration
- unit tests

Verification:

```bash
python -m pytest
```

## Execution 4: Normalization

Prompt:

```text
Implement FFmpeg normalization. Normalize every clip to configured resolution, fps, yuv420p pixel format, H.264 video, AAC audio, 48000 Hz sample rate, and stereo channels. If a clip has no audio, add silent audio. Keep normalized clips and FFmpeg logs in the workdir.
```

Implementation notes:

- Use FFprobe results to choose the with-audio or silent-audio command.
- Use deterministic intermediate filenames derived from clip IDs.
- Return clear errors if FFmpeg fails.

Verification:

```bash
python -m pytest
```

Manual smoke test after sample/generated clips exist:

```bash
python -m app.main --config examples/ordered_job.json --workdir tmp --verbose
```

## Execution 5: Ordered Concatenation

Prompt:

```text
Implement `ordered_concat` end to end. Sort clips by `order`, validate files, probe clips, normalize clips, generate concat.txt, concatenate with the FFmpeg concat demuxer, and write final metadata with clip order, durations, FFmpeg logs, output path, warnings, and processing time.
```

Deliverables:

- `app/stitcher.py`
- ordered mode wired into `app/main.py`
- ordered metadata output

Verification:

```bash
python -m pytest
docker build -t ai-video-stitcher .
docker run --rm \
  -v "$(pwd)/input:/app/input" \
  -v "$(pwd)/output:/app/output" \
  ai-video-stitcher \
  python -m app.main --config /app/input/ordered_job.json --workdir /app/tmp --verbose
```

Acceptance checks:

- final MP4 exists
- metadata JSON exists
- at least 3 clips concatenate correctly
- mixed resolution/codecs normalize before concat
- no-audio clips receive silent audio

## Execution 6: Test Clip Generator

Prompt:

```text
Create `scripts/make_test_clips.py`. It should cut a source video into fixed-length clips, create ordered and shuffled job JSON files, optionally shuffle job order deterministically with a seed, and include `ground_truth_order`.
```

Deliverables:

- `scripts/make_test_clips.py`
- ordered generated job
- shuffled generated job
- ground truth order in JSON

Verification:

```bash
python scripts/make_test_clips.py \
  --source input/source.mp4 \
  --output-dir input/generated_clips \
  --clip-length 5 \
  --shuffle true \
  --seed 123
```

## Execution 7: Frame Extraction

Prompt:

```text
Implement deterministic boundary frame extraction. For each clip, extract first and last frames into the workdir. Prefer OpenCV frame indexing for reliability, with FFmpeg fallback if needed. Record frame paths or extraction diagnostics in debug metadata.
```

Deliverables:

- `app/frame_extractor.py`
- first/last frame extraction
- practical tests or mocked coverage

Verification:

```bash
python -m pytest
```

## Execution 8: Similarity Scoring

Prompt:

```text
Implement visual boundary similarity. Compare the last frame of clip A to the first frame of clip B using color histogram similarity and perceptual hash similarity. Combine them as `0.6 * histogram_similarity + 0.4 * perceptual_hash_similarity`. Add deterministic tests for identical, similar, and different images.
```

Deliverables:

- `app/similarity.py`
- histogram similarity
- perceptual hash similarity, such as dHash or aHash
- combined transition score
- `tests/test_similarity.py`

Verification:

```bash
python -m pytest
```

## Execution 9: Order Solver And Evaluation

Prompt:

```text
Implement the shuffled order solver. Build a directed transition score matrix. For up to 8 clips, use brute-force permutation search. For more than 8 clips, use deterministic greedy ordering. Add ground-truth evaluation with exact order match, position accuracy, and adjacency accuracy.
```

Implementation notes:

- Exclude self-transitions.
- Use stable tie-breaking by `clip_id`.
- Compute confidence from winning score, runner-up score margin, and score distribution.
- Emit warnings for low confidence, ties, or weak score separation.

Deliverables:

- `app/order_solver.py`
- `app/evaluator.py`
- `tests/test_order_solver.py`
- evaluation metadata

Verification:

```bash
python -m pytest
```

## Execution 10: Shuffled Reorder Concatenation

Prompt:

```text
Implement `shuffled_reorder_concat` end to end. Probe clips, extract boundary frames, compute pairwise transition scores, predict order, evaluate against ground truth when provided, normalize clips, concatenate in predicted order, and write metadata with predicted order, scores, confidence, warnings, and failure reasons.
```

Deliverables:

- shuffled mode wired into `app/main.py`
- transition score metadata
- confidence metadata
- evaluation metadata

Verification:

```bash
python -m pytest
docker build -t ai-video-stitcher .
docker run --rm \
  -v "$(pwd)/input:/app/input" \
  -v "$(pwd)/output:/app/output" \
  ai-video-stitcher \
  python -m app.main --config /app/input/shuffled_job.json --workdir /app/tmp --verbose
```

Acceptance checks:

- predicted order is emitted
- final reordered MP4 exists
- transition scores are emitted
- evaluation appears when ground truth is provided
- warnings appear for low-confidence cases

## Execution 11: Optional Timeline Assembly

Prompt:

```text
Implement optional `timeline_assembly` mode. Assemble clips by explicit `order`, preserve role metadata, normalize all clips, concatenate them, and write final metadata. Do not implement automatic AI clip placement.
```

Deliverables:

- timeline mode support
- role metadata
- `examples/timeline_job.json`

Verification:

```bash
python -m pytest
```

## Execution 12: Acceptance And README Pass

Prompt:

```text
Perform a final acceptance pass against the uploaded specification. Update README with build, run, ordered concatenation, shuffled reorder, test clip generation, metadata interpretation, limitations, and next steps. Run unit tests and Docker smoke checks. Report remaining gaps clearly.
```

Verification:

```bash
python -m pytest
docker build -t ai-video-stitcher .
```

Final acceptance should confirm:

- Docker image builds
- ordered concat works in Docker
- shuffled reorder works in Docker
- metadata is produced on success and recoverable failure
- no-audio clips are handled
- generated test clips provide ground truth evaluation
- limitations are documented
