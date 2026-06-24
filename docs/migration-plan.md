# OpenReel Migration Plan

## Phase 1: Repo Restructure

- Move the existing Python pipeline to `services/stitching-pipeline`.
- Move the previous browser MVP to `legacy/manual-editor-mvp`.
- Import OpenReel browser editor packages into `apps/`, `packages/`, `infra/`, and `scripts/`.
- Preserve OpenReel license material under `docs/upstream/openreel`.

## Phase 2: Adapter Contract

- Convert pipeline job/result JSON into an OpenReel `Project`.
- Preserve clip role, confidence, source path, trim, track index, and timeline position in clip metadata.
- Use placeholder media records until browser file handles are attached.

## Phase 3: Product Workflow

- Add a car-sales workflow panel in the editor.
- Add import support for pipeline results.
- Show sales pitch sections as timeline markers or grouped clips.
- Keep manual editing available for final adjustment.

## Phase 4: AI Pipeline Upgrade

- Add car-specific scene and feature detection.
- Produce section-aware sales pitch drafts instead of only continuous-source reconstruction.
- Add narration, captions, and CTA planning.

## Phase 5: Export and QA

- Use OpenReel export for browser rendering.
- Keep the Python pipeline as a validation and fallback assembly service.
- Add golden sample walk-around videos and acceptance checks.
