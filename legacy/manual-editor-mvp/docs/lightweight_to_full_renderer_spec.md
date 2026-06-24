# Lightweight-First, Full-Later Renderer Specification

## Purpose

This specification defines how to build a browser-based manual video editor with a lightweight renderer first, while preserving a clean migration path to a full renderer later.

It also defines how this editor should coexist with the existing `ai-video-stitching-validation-pipeline` in this repository.

The core design question is:

> Can we ship a lightweight MVP now without creating architectural debt that blocks a future professional renderer?

The answer is yes, if the project uses a renderer-neutral timeline model and treats each renderer as a replaceable backend.

## System Boundary

This repository now has two related but separate product surfaces.

### Existing Python Pipeline

Location:

```text
app/
```

Responsibility:

- Validate ordered concatenation jobs.
- Validate shuffled clip-order reconstruction.
- Normalize clips through FFmpeg.
- Concatenate whole clips.
- Preserve role metadata for explicit timeline assembly.
- Produce metadata for debugging and evaluation.

This pipeline is a backend validation/stitching worker. It is not an interactive editor and should not become responsible for browser UI state.

### Browser Manual Editor

Location:

```text
web/manual-editor/
```

Responsibility:

- Let users manually import, order, trim, mute, and arrange clips.
- Let users add independent audio tracks such as narration and music.
- Preview the timeline locally in the browser.
- Export through a renderer backend.
- Export project/timeline JSON.

This editor is a user-facing authoring tool. It should not depend on the Python worker for its first pure-browser export path.

## Clean Integration Strategy

Use three separate data contracts:

1. **Editor Project Format**
   - Full interactive project state.
   - Stores assets, tracks, clips, trims, volume, transforms, selection-independent timeline data.
   - Owned by the browser editor.

2. **Renderer Timeline IR**
   - Minimal normalized timeline consumed by renderers.
   - Renderer-neutral.
   - Generated from the editor project before preview/export.

3. **Pipeline Job JSON**
   - Existing backend worker job shape.
   - Used only for compatibility with `app.main`.
   - Should remain narrower than the editor project format until the backend intentionally grows.

This prevents the lightweight browser renderer, future full renderer, and Python validation worker from all fighting over one overloaded JSON shape.

## Architecture

```text
Browser UI
  |
  v
Editor Project Format
  |
  +--> Preview Engine
  |
  +--> Renderer Timeline IR
  |      |
  |      +--> MediaRecorderRenderer   MVP, realtime WebM
  |      |
  |      +--> WebCodecsRenderer       future, MP4/WebM, worker-based
  |      |
  |      +--> FFmpegWasmRenderer      optional compatibility fallback
  |
  +--> Pipeline Job Adapter
         |
         v
Python ai-video-stitching-validation-pipeline
```

## Renderer Interface

Every renderer backend must implement the same conceptual interface:

```ts
interface Renderer {
  id: string;
  label: string;
  capabilities(): Promise<RendererCapabilities>;
  render(project: RenderTimeline, settings: ExportSettings): Promise<RenderResult>;
}
```

Example capability shape:

```ts
interface RendererCapabilities {
  containers: Array<"webm" | "mp4">;
  videoCodecs: Array<"vp8" | "vp9" | "h264" | "av1" | "hevc">;
  audioCodecs: Array<"opus" | "aac">;
  supportsRealtimeOnly: boolean;
  supportsOfflineRender: boolean;
  supportsMultipleAudioTracks: boolean;
  supportsVideoTransforms: boolean;
  supportsTransitions: boolean;
}
```

The UI may ask for capabilities, but it must not assume that one renderer is always available.

## Editor Project Format

The editor project is allowed to contain UI-friendly metadata and future fields.

```json
{
  "schema": "browser-video-editor-project",
  "version": 1,
  "assets": [
    {
      "id": "asset_video_1",
      "kind": "video",
      "name": "scene-a.mp4",
      "duration": 12.4,
      "width": 1920,
      "height": 1080,
      "source": {
        "type": "browser-file",
        "name": "scene-a.mp4"
      }
    },
    {
      "id": "asset_music_1",
      "kind": "audio",
      "name": "music.wav",
      "duration": 60,
      "source": {
        "type": "browser-file",
        "name": "music.wav"
      }
    }
  ],
  "timeline": {
    "duration": 18,
    "videoTracks": [
      {
        "id": "video_track_1",
        "clips": [
          {
            "id": "clip_1",
            "assetId": "asset_video_1",
            "timelineStart": 0,
            "sourceStart": 2,
            "duration": 8,
            "muted": true,
            "transform": {
              "x": 0,
              "y": 0,
              "scale": 1,
              "rotation": 0,
              "opacity": 1
            }
          }
        ]
      }
    ],
    "audioTracks": [
      {
        "id": "narration_track",
        "role": "narration",
        "clips": [
          {
            "id": "narration_clip_1",
            "assetId": "asset_narration_1",
            "timelineStart": 0,
            "sourceStart": 0,
            "duration": 8,
            "volume": 1
          }
        ]
      },
      {
        "id": "music_track",
        "role": "music",
        "clips": [
          {
            "id": "music_clip_1",
            "assetId": "asset_music_1",
            "timelineStart": 0,
            "sourceStart": 12,
            "duration": 18,
            "volume": 0.25,
            "fadeIn": 1,
            "fadeOut": 2
          }
        ]
      }
    ]
  }
}
```

Browser project files cannot permanently store direct access to local files. Reopening a project must ask the user to relink local assets unless the File System Access API is used with retained permissions.

## Renderer Timeline IR

The renderer timeline is stricter than the editor project. It should be generated immediately before preview or export.

Rules:

- All timeline positions are seconds.
- All source positions are seconds.
- Clip durations must be positive.
- Clip references must resolve to loaded assets.
- Track order must be explicit.
- Unsupported fields should be rejected by the renderer capability check before export.

Example:

```json
{
  "schema": "renderer-timeline-ir",
  "version": 1,
  "canvas": {
    "width": 1280,
    "height": 720,
    "fps": 30,
    "background": "#000000"
  },
  "assets": {
    "asset_video_1": {
      "kind": "video",
      "objectUrl": "blob:browser-runtime-url"
    },
    "asset_music_1": {
      "kind": "audio",
      "objectUrl": "blob:browser-runtime-url"
    }
  },
  "tracks": [
    {
      "id": "video_track_1",
      "kind": "video",
      "zIndex": 0,
      "clips": [
        {
          "id": "clip_1",
          "assetId": "asset_video_1",
          "timelineStart": 0,
          "sourceStart": 2,
          "duration": 8,
          "muted": true,
          "transform": {
            "x": 0,
            "y": 0,
            "scale": 1,
            "rotation": 0,
            "opacity": 1
          }
        }
      ]
    },
    {
      "id": "music_track",
      "kind": "audio",
      "role": "music",
      "clips": [
        {
          "id": "music_clip_1",
          "assetId": "asset_music_1",
          "timelineStart": 0,
          "sourceStart": 12,
          "duration": 18,
          "volume": 0.25
        }
      ]
    }
  ]
}
```

## Lightweight Renderer V1

Renderer name:

```text
MediaRecorderRenderer
```

Purpose:

- Ship a useful pure-browser MVP quickly.
- Support manual montage ordering and simple audio replacement/mixing.
- Avoid local native clients and cloud rendering.

Implementation approach:

```text
HTMLVideoElement(s)
  -> Canvas draw loop
  -> canvas.captureStream(fps)
  -> video MediaStreamTrack

HTMLAudioElement(s)
  -> Web Audio graph
  -> GainNode per audio clip/track
  -> MediaStreamDestination
  -> audio MediaStreamTrack

video track + audio track
  -> MediaRecorder
  -> WebM Blob
```

Required MVP capabilities:

- One primary video track.
- Mute source video audio.
- Independent narration audio track.
- Independent music audio track.
- Per-audio-track volume.
- Clip trimming.
- Clip ordering.
- Real-time WebM export.
- Preview should use the same timeline model as export.

Acceptable MVP limitations:

- Export is real-time.
- Export container is WebM.
- Exact frame accuracy is best-effort.
- MP4/H.264/AAC is not guaranteed.
- Complex overlaps, blend modes, masks, speed ramps, and transitions are out of scope.
- Very long or 4K timelines may be slow.

## Full Renderer V2

Renderer name:

```text
WebCodecsRenderer
```

Purpose:

- Produce more professional, predictable exports.
- Support MP4/WebM output where browser capabilities allow.
- Reduce timing drift and improve export fidelity.

Expected architecture:

```text
Main thread
  -> UI and project state

Render worker
  -> timeline scheduling
  -> decode orchestration
  -> frame rendering via OffscreenCanvas

WebCodecs
  -> VideoDecoder
  -> VideoEncoder
  -> AudioDecoder/AudioEncoder where supported

Muxer
  -> MP4 or WebM packaging
```

Expected capabilities:

- Offline render that is not tied to preview playback speed.
- Better timestamp control.
- MP4 output when H.264/AAC support is available.
- WebM fallback.
- More reliable audio/video sync.
- Worker-based rendering.
- Better handling for longer videos.

Additional future capabilities:

- Multiple video tracks.
- Visual compositing.
- Text/image overlays.
- Transitions.
- Speed changes.
- Keyframes.
- Captions/subtitles.

## Relationship To The Existing Python Pipeline

The existing Python pipeline should remain stable and narrowly scoped.

It should continue to support:

- `ordered_concat`
- `shuffled_reorder_concat`
- `timeline_assembly`

The browser editor can export a compatibility job for the current pipeline when the timeline fits the backend's existing capability subset:

- ordered clips
- whole source clips or trims that the backend explicitly supports later
- hard cuts
- no independent browser-only audio tracks unless backend support is added

Current compatibility level:

```text
Browser editor timeline -> Pipeline Job JSON
```

Useful for:

- validation
- metadata
- backend smoke tests
- whole-clip timeline assembly

Not yet suitable for:

- precise browser trim preservation
- independent narration/music mixdown
- transforms
- transitions
- multi-track visual compositing

## Adapter Rules

The adapter from browser editor project to Python pipeline job must be intentionally lossy and explicit.

If an editor project uses unsupported backend features, the adapter must warn or block export.

Examples:

- If a clip has `sourceStart > 0`, warn that the current backend may ignore trim fields.
- If audio tracks exist, warn that the current backend does not mix independent audio.
- If transforms exist, warn that the current backend does not apply transforms.
- If more than one video track exists, warn that the current backend does not composite tracks.

The adapter should not silently flatten complex editor state into an incorrect backend job.

## Recommended Directory Shape

Current:

```text
app/
web/manual-editor/
docs/
examples/
```

Recommended as the browser editor grows:

```text
web/manual-editor/
  index.html
  styles.css
  app.js
  model/
    project.js
    timeline-ir.js
  preview/
    preview-engine.js
  renderers/
    media-recorder-renderer.js
    webcodecs-renderer.js
  adapters/
    pipeline-job-adapter.js
```

The current static MVP can stay simple, but new work should move toward these boundaries before the timeline model becomes more complex.

## Acceptance Criteria

### MVP Acceptance

- User can import video files locally.
- User can manually order clips.
- User can trim clips.
- User can mute original video audio.
- User can add narration audio.
- User can add music audio.
- User can control narration/music volume.
- User can preview the assembled result.
- User can export WebM fully in-browser.
- User can export project JSON.
- User can export a pipeline compatibility job when the timeline is supported.

### Architecture Acceptance

- Timeline data does not depend on `HTMLVideoElement`, `MediaRecorder`, WebCodecs, or FFmpeg.
- Preview and export both consume the same normalized timeline.
- Renderer capability checks happen before export.
- Backend pipeline export is handled by an adapter, not by making the browser project format match the Python job format.
- Unsupported adapter conversions produce clear warnings.

### Future Renderer Acceptance

- WebCodecs renderer can be added without rewriting the editor project model.
- MediaRecorder renderer remains available as a fallback.
- The same project can be rendered by different renderer backends when capabilities allow.

## Implementation Sequence

1. Extract the current browser editor state into an explicit editor project object.
2. Add audio asset import.
3. Add `videoTracks` and `audioTracks` instead of one flat clip list.
4. Add a renderer timeline IR generator.
5. Move current export code behind `MediaRecorderRenderer`.
6. Add a preview engine that consumes the same IR.
7. Add pipeline job adapter warnings.
8. Add WebCodecs capability probe.
9. Implement `WebCodecsRenderer` behind the same renderer interface.

This sequence lets the lightweight renderer ship first while keeping the full renderer path clean.
