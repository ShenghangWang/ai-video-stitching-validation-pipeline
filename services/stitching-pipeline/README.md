# AI Video Stitching Validation Pipeline

Dockerized Python worker for validating backend video stitching, ordered concatenation, shuffled clip reordering, and explicit timeline assembly for a future AI video production pipeline.

## What It Does

- Loads JSON job configs through `python -m app.main`.
- Probes clips with FFprobe and records duration, dimensions, FPS, codecs, and audio presence.
- Normalizes clips with FFmpeg to MP4/H.264/AAC, `yuv420p`, configured resolution/FPS, 48000 Hz stereo audio.
- Adds silent audio when an input clip has no audio.
- Concatenates normalized clips with the FFmpeg concat demuxer.
- Reorders shuffled clips using first/last boundary frame similarity.
- Emits structured success/failure metadata for debugging and evaluation.
- Runs as a Dockerized CLI worker.

## Repository Contents

- `AI Video Stitching Pipeline Specification.pdf` - uploaded source specification
- `docs/executable_build_plan.md` - Codex execution plan
- `docs/spec_integrity_review.md` - specification and plan review
- `docs/acceptance_report.md` - final acceptance notes
- `source_chinese_complete.mp4` - complete Chinese-language source video
- `source_english_indoors_complete.mp4` - complete English-language indoor source video
- `source_english_outdoors_complete.mp4` - complete English-language outdoor source video

## Status

Execution 12 is complete. The MVP worker now includes the full planned implementation path:

- ordered concatenation
- shuffled reorder and concatenation
- explicit timeline assembly
- deterministic test clip generation
- Docker runtime support
- unit tests for all core modules

## Local Validation

```bash
python -m pytest
```

## Docker

Build the image:

```bash
docker build -t ai-video-stitcher .
```

Check runtime dependencies:

```bash
docker run --rm ai-video-stitcher python -m app.runtime
docker run --rm ai-video-stitcher ffmpeg -version
docker run --rm ai-video-stitcher ffprobe -version
```

## Generate Test Clips

Generate fixed-length clips and matching ordered/shuffled job configs:

```bash
python scripts/make_test_clips.py \
  --source source_english_outdoors_complete.mp4 \
  --output-dir input/generated_clips \
  --clip-length 5 \
  --shuffle true \
  --seed 123
```

Generated files include:

- `input/generated_clips/ordered_job.json`
- `input/generated_clips/shuffled_job.json`
- `input/generated_clips/manifest.json`

## Run Ordered Concatenation

```bash
python -m app.main \
  --config input/generated_clips/ordered_job.json \
  --workdir tmp \
  --verbose
```

Docker form:

```bash
docker run --rm \
  -v "$(pwd):/workspace" \
  -w /workspace \
  ai-video-stitcher \
  python -m app.main --config input/generated_clips/ordered_job.json --workdir tmp --verbose
```

## Run Shuffled Reordering

```bash
python -m app.main \
  --config input/generated_clips/shuffled_job.json \
  --workdir tmp \
  --verbose
```

The metadata includes:

- `predicted_order`
- `transition_scores`
- `confidence_score`
- `ordering_warnings`
- `evaluation` when `ground_truth_order` is provided

## Run Timeline Assembly

Use `examples/timeline_job.json` as the shape reference, then replace clip paths with real files:

```bash
python -m app.main \
  --config examples/timeline_job.json \
  --workdir tmp \
  --verbose
```

Timeline metadata preserves each clip role in `timeline_roles`.

## Legacy Browser Manual Editor

The former manual fallback editor now lives in `../../legacy/manual-editor-mvp`. It is a frozen prototype kept for reference while the product migrates to OpenReel.

Run it locally:

```bash
python -m http.server 4173 --directory ../../legacy/manual-editor-mvp
```

Then open:

```text
http://127.0.0.1:4173
```

The editor does not use the shuffled AI ordering algorithm and does not require cloud rendering. See `../../legacy/manual-editor-mvp/docs/browser_manual_editor_plan.md` for the old architecture decision and limitations.

The old renderer migration path is archived in `../../legacy/manual-editor-mvp/docs/lightweight_to_full_renderer_spec.md`.

Open-source renderer research, commercial dependency gates, and the executable implementation sequence are archived in `../../legacy/manual-editor-mvp/docs/`.

The old renderer capability matrix is archived in `../../legacy/manual-editor-mvp/docs/current_renderer_capabilities.md`.

Browser editor checks:

```bash
cd ../../legacy/manual-editor-mvp
npm run check
npm test
```

## Metadata

Every successful job writes a metadata JSON file with:

- `job_id`, `mode`, `status`, `stage`
- input clip metadata
- output video path
- normalized clip paths and FFmpeg commands
- concat file path and FFmpeg logs
- processing time
- warnings

Failed jobs write structured error metadata whenever the metadata path can be determined.

## Limitations

- Shuffled ordering is an MVP visual-boundary heuristic, not semantic video understanding.
- Repeated scenes, fades, hard cuts, or visually similar car angles can reduce ordering confidence.
- The current transition mode is hard cut only.
- No API server, job queue, cloud storage, authentication, subtitles, music, or AI narration generation is included.
- Docker verification depends on network access to Docker Hub and Debian package mirrors.

## Next Steps

- Run generated clip jobs inside Docker against the included source videos.
- Tune confidence thresholds after collecting real metadata from sample clips.
- Add CI once repository secrets and runner preferences are decided.
- Later extensions can add transitions, subtitles, voiceover overlay, object storage, and an API/queue layer.
