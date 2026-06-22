# Specification And Build Plan Integrity Review

## Summary

The uploaded specification is coherent and implementable. The MVP is well-scoped around a Dockerized Python/FFmpeg worker with two required modes:

- `ordered_concat`
- `shuffled_reorder_concat`

The optional `timeline_assembly` mode is useful, but should remain after the required ordered and shuffled validation paths.

The original Codex build plan matched the specification at a high level. The improved plan in `docs/executable_build_plan.md` tightens the execution boundaries, adds missing validation details, and defines several ambiguous pieces that the specification intentionally left open.

## Integrity Findings

1. The PDF command examples have formatting artifacts.
   Several commands appear without spaces, for example `dockerbuild-tai-video-stitcher.` and `python-mapp.main`. These should be interpreted as normal shell commands:

   ```bash
   docker build -t ai-video-stitcher .
   python -m app.main --config /app/input/job.json
   ```

2. The CLI-first architecture is consistent.
   The spec correctly says the core logic should not depend on FastAPI. A REST API can be added later, but the MVP should stay a command-line worker.

3. Normalization before concat is essential and correctly emphasized.
   The concat demuxer should only receive normalized clips. The implementation should never rely on direct `-c copy` concatenation of unnormalized user inputs.

4. No-audio handling needs explicit probing.
   The plan should include an FFprobe step before normalization so the worker can choose the correct FFmpeg command for clips with or without audio.

5. Last-frame extraction needs a robust implementation.
   The spec suggests `ffmpeg -sseof -0.1`, which can be brittle for very short clips or files with odd timestamps. The implementation should prefer OpenCV frame indexing when reliable, or use FFprobe duration plus FFmpeg seeking with clear fallback behavior.

6. The shuffled ordering algorithm is acceptable for MVP but should be transparent.
   Histogram and perceptual hash similarity can fail on repeated scenes, camera jumps, fades, hard cuts, or visually similar car angles. This is acceptable for validation if scores, confidence, and warnings are included in metadata.

7. Confidence scoring was underspecified.
   The improved plan defines confidence as a function of the winning path score, runner-up margin, and score distribution. This makes uncertainty explainable instead of decorative.

8. Start-clip detection should be deterministic.
   Brute-force search over all permutations avoids relying heavily on a fragile first-clip heuristic for small N. Tie-breaking should be stable by `clip_id`.

9. Failure metadata should be produced whenever possible.
   The spec requires clear errors, but the build plan should explicitly require metadata output on failed jobs when the metadata path can be determined.

10. Test clip generation is not optional for validation quality.
    The `make_test_clips.py` script should be built before shuffled ordering integration so every shuffled run can be evaluated against ground truth.

11. The optional timeline mode should not slow down MVP acceptance.
    It belongs after ordered concat, test clip generation, and shuffled reorder stitching are working.

12. Sample media should be treated as validation input, not production assets.
    The current videos are small enough for the initial private repository, but generated outputs, temp frames, and normalized clips should be ignored by git.

## Recommended Scope For First Implementation PR

The first implementation PR should include:

- project skeleton
- CLI config loading
- structured metadata writer
- error model
- Dockerfile
- requirements
- tests for config validation

It should not include the full FFmpeg pipeline yet. Keeping the first implementation small will make later execution steps easier to verify.
