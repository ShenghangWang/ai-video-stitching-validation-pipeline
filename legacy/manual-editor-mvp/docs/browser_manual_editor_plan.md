# Browser Manual Video Editor Plan

## Evaluation

The manager proposal is directionally correct, but it is not the best immediate implementation plan for this repository.

What is right:

- A pure browser editor is feasible for light and medium manual editing.
- WebCodecs is the right long-term foundation for fast local hardware encode/decode.
- Muxing is a real product risk because WebCodecs does not produce MP4 files by itself.
- Browser support differences must be treated as product behavior, not only engineering trivia.

What needs correction:

- WebAV is a useful investigation target, but it should not be chosen blindly. The current need is a manual fallback editor, not a full creative suite, and the repository has no frontend dependency stack yet.
- Remotion is not a fit for user-driven timeline editing. It is strongest for templated/programmatic video generation.
- WebCodecs plus MP4 muxing is not the fastest safe MVP. It gives better performance, but it also adds codec support, audio sync, muxing, and Safari behavior risk.
- WebGPU zero-copy is premature for the first manual tool. The immediate problem is human clip ordering and trimming, not 4K color pipelines.

## Recommended Path

Build in two layers.

1. Pure browser manual editor MVP
   - Static HTML/CSS/JavaScript.
   - Import local video files through `<input type="file">`.
   - Add clips to a timeline.
   - Manually reorder, trim, mute, duplicate, and delete timeline entries.
   - Preview the assembled sequence in the browser.
   - Export a real video in-browser using `HTMLCanvasElement.captureStream`, Web Audio, and `MediaRecorder`.
   - Export project JSON for review or future backend compatibility.

2. WebCodecs export engine
   - Keep the same UI and timeline model.
   - Replace the realtime `MediaRecorder` export path with decode/process/encode workers.
   - Add MP4 muxing through a maintained muxer.
   - Add browser capability detection and export presets.

This approach gives the team a usable manual solution quickly while preserving a clean path to the stronger architecture described in the proposal.

The detailed renderer-neutral architecture is specified in `docs/lightweight_to_full_renderer_spec.md`.

## Current Implementation

The first MVP lives in `web/manual-editor`.

It intentionally does not modify the existing Python/Docker AI stitching pipeline. The existing `timeline_assembly` worker remains available for full-clip ordered concatenation, while the browser editor solves the montage-ordering gap manually.

Supported now:

- Local multi-file import.
- Timeline add, reorder, duplicate, trim, mute, and delete.
- Sequential preview.
- Browser-only WebM export with audio capture when supported by the browser.
- Project JSON export.
- Backend-style timeline job JSON export with placeholder paths.

Known limitations:

- Export is real-time because it uses `MediaRecorder`.
- Output container is WebM in the MVP, not MP4.
- Browser project files cannot permanently reference local files. Users must reselect source media in future sessions.
- The current backend JSON export preserves trim fields for future use, but the existing Python worker only concatenates whole clips.
- This MVP is best for 1080p short-form workflows. Heavy 4K timelines should wait for the WebCodecs worker pipeline.

## Next Engineering Step

After user validation, add a WebCodecs capability probe and a second export engine:

- Use `VideoDecoder` to decode source clips.
- Render frames through `OffscreenCanvas` in a worker.
- Use `VideoEncoder` for H.264 where available.
- Add a maintained MP4 muxer.
- Keep `MediaRecorder` WebM as the compatibility fallback.
