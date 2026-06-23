# Executable Renderer Build Plan

This plan extends the browser manual editor while preserving the existing Python `ai-video-stitching-validation-pipeline`.

Each execution should produce a small, reviewable result with verification commands.

## Execution 0: Open Source Renderer Research

Status: completed.

Prompt:

```text
Research open source browser video renderer/editor projects. Evaluate technical fit and commercial license risk. Recommend whether to reuse a dependency or build our own renderer.
```

Deliverables:

- `docs/open_source_renderer_research.md`
- Decision on preferred dependency candidates

Verification:

```bash
test -f docs/open_source_renderer_research.md
```

## Execution 1: Renderer-Neutral Project Boundary

Status: completed.

Prompt:

```text
Extract browser editor exports into renderer-neutral project and adapter helpers. Keep the UI simple, but stop hardcoding project JSON and pipeline JSON directly inside app UI handlers.
```

Deliverables:

- `web/manual-editor/model/project.js`
- `web/manual-editor/adapters/pipeline-job-adapter.js`
- `web/manual-editor/app.js` imports these helpers
- `web/manual-editor/index.html` loads `app.js` as an ES module

Verification:

```bash
node --check web/manual-editor/app.js
node --check web/manual-editor/model/project.js
node --check web/manual-editor/adapters/pipeline-job-adapter.js
python -m pytest
```

## Execution 2: Audio Asset Import And Tracks

Status: completed.

Prompt:

```text
Extend the manual editor to import audio files separately from video files. Add narration and music tracks to the project model, with timeline start, source start, duration, and volume.
```

Deliverables:

- Audio file import support
- `audioTracks` in project JSON
- UI controls for narration/music volume
- Project JSON containing video and audio assets

Verification:

```bash
node --check web/manual-editor/app.js
python -m pytest
```

Manual smoke:

```text
Import one video, one narration file, and one music file.
Mute the video audio.
Export project JSON and confirm audioTracks are present.
```

## Execution 3: Renderer Timeline IR Generator

Status: completed.

Prompt:

```text
Add a normalized Renderer Timeline IR generator. Validate asset references, positive durations, explicit track order, canvas settings, and unsupported features before preview/export.
```

Deliverables:

- `web/manual-editor/model/timeline-ir.js`
- validation result with errors/warnings
- tests or browser-checkable diagnostics

Verification:

```bash
node --check web/manual-editor/model/timeline-ir.js
node --check web/manual-editor/app.js
python -m pytest
```

## Execution 4: MediaRecorderRenderer Module

Status: completed.

Prompt:

```text
Move current WebM export code into a replaceable MediaRecorderRenderer module that consumes Renderer Timeline IR and reports progress/status through callbacks.
```

Deliverables:

- `web/manual-editor/renderers/media-recorder-renderer.js`
- renderer capability object
- app export button calls the renderer interface

Verification:

```bash
node --check web/manual-editor/renderers/media-recorder-renderer.js
node --check web/manual-editor/app.js
python -m pytest
```

Manual smoke:

```text
Import clips, trim/reorder, export WebM, confirm download completes.
```

## Execution 5: Pipeline Job Adapter Warnings

Status: completed.

Prompt:

```text
Make backend pipeline job export explicit about unsupported editor features. Warn or block when trims, independent audio, transforms, or multiple video tracks would be lost.
```

Deliverables:

- adapter warning list
- UI status message when warnings exist
- job JSON remains compatible with current Python config parser

Verification:

```bash
node --check web/manual-editor/adapters/pipeline-job-adapter.js
node --check web/manual-editor/app.js
python -m pytest
```

## Execution 6: Mediabunny Prototype

Status: completed as an isolated prototype shell.

Prompt:

```text
Create a separate prototype page or module that uses Mediabunny to read one browser-selected media file and write a small WebM or MP4 output, behind an experimental flag. Do not replace the MVP renderer yet.
```

Deliverables:

- dependency decision recorded
- isolated prototype module/page
- capability notes for browser support

Verification:

```bash
npm audit --omit=dev
node --check relevant-files
```

Manual smoke:

```text
Select a short file and produce a playable output.
```

## Execution 7: WebCodecsRenderer MVP

Status: completed as a guarded capability scaffold. Full encoding remains intentionally disabled until the Mediabunny/WebCodecs PoC is accepted.

Prompt:

```text
Implement a first WebCodecsRenderer behind the same renderer interface. Start with one video track and mixed audio. Keep MediaRecorderRenderer as fallback.
```

Deliverables:

- `web/manual-editor/renderers/webcodecs-renderer.js`
- capability detection
- fallback behavior
- export compatibility notes

Verification:

```bash
node --check web/manual-editor/renderers/webcodecs-renderer.js
node --check web/manual-editor/app.js
python -m pytest
```

## Execution 8: Legal And Dependency Gate

Status: completed.

Prompt:

```text
Before shipping commercial builds, generate a dependency inventory, license notice file, and legal review checklist for all browser editor dependencies and codecs.
```

Deliverables:

- dependency inventory
- license notice file
- legal review checklist
- explicit allow/block list

Verification:

```bash
npm ls --all
npm audit --omit=dev
```

## Execution 9: Python Pipeline Compatibility Extension

Status: completed by decision. The Python pipeline is not extended yet because the browser project and Renderer Timeline IR are still the source of truth for audio/trim behavior.

Prompt:

```text
If backend compatibility is still needed, extend the Python timeline_assembly mode only after the browser project and Renderer Timeline IR are stable. Add explicit support for trims and independent audio mixdown, or keep warning/block behavior in the adapter.
```

Deliverables:

- updated Python config parser if needed
- updated stitcher behavior if needed
- tests for trim/audio compatibility

Verification:

```bash
python -m pytest
```
