# Current Renderer Capabilities

This document describes the renderer that is currently implemented in `web/manual-editor`.

The current renderer is:

```text
MediaRecorderRenderer
```

It is a lightweight browser-only renderer. It is good enough for MVP testing of manual ordering, trimming, muting, and simple independent audio tracks. It is not yet the future full WebCodecs renderer.

## What It Can Do Now

### Browser-Only Operation

- Runs fully in the browser.
- Does not require a local native client.
- Does not require cloud rendering.
- Does not require the Python/FFmpeg validation pipeline for export.

### Media Import

- Imports local video files through the browser file picker.
- Imports local audio files through the browser file picker.
- Reads basic browser metadata such as duration, width, and height.

### Video Timeline

- Adds imported video clips to a single video timeline.
- Supports manual clip ordering.
- Supports duplicate and delete for video timeline clips.
- Supports simple clip trimming with `start` and `end` seconds.
- Supports muting the original video audio per clip.
- Supports simple preview playback across ordered clips.

### Audio Tracks

- Supports two independent audio lanes:
  - narration
  - music
- Adds imported audio files to either narration or music.
- Supports track-level volume control for narration and music.
- Exports narration/music into the final WebM output through Web Audio.

### Export

- Exports in-browser using:

```text
HTMLVideoElement
Canvas captureStream()
HTMLAudioElement
Web Audio API
MediaRecorder
```

- Produces WebM output.
- Combines:
  - rendered video frames from canvas
  - muted or unmuted source video audio
  - narration track
  - music track

### Data Contracts

- Exports renderer-neutral project JSON.
- Builds Renderer Timeline IR before export.
- Exports Python pipeline compatibility JSON with warnings when the Python pipeline would lose browser-only data.

## What It Cannot Do Yet

### Export Format

- Does not export MP4.
- Does not guarantee H.264/AAC output.
- WebM codec choice depends on browser `MediaRecorder` support.

### Render Performance

- Export is real-time or near real-time.
- It does not render faster than playback speed.
- Long videos may take a long time to export.

### Precision

- Does not guarantee professional frame-accurate export.
- Audio/video sync is best-effort.
- Trim points are second-based and browser-media-element based, not frame-exact.

### Visual Editing

- Does not support multiple video tracks.
- Does not support picture-in-picture.
- Does not support overlays.
- Does not support text rendering.
- Does not support subtitles/captions burned into video.
- Does not support masks.
- Does not support blend modes.
- Does not support transitions.
- Does not support speed changes or speed ramping.
- Does not support keyframes.
- Does not apply transform controls such as position, scale, rotation, or opacity during export yet.

### Audio Editing

- Does not support detailed audio waveform editing.
- Does not support dragging audio clips along the timeline.
- Does not support audio clip split/delete from the audio lane UI.
- Does not support fades or ducking yet.
- Does not support more than the two current logical audio lanes without code changes.

### Project Persistence

- Project JSON stores asset metadata, but browser security prevents it from permanently storing direct access to local files.
- Reopening saved projects will require relinking local files unless a future File System Access API flow is added.

### Backend Compatibility

- The Python validation pipeline can still assemble whole ordered clips.
- The current Python pipeline does not yet preserve browser-only trim, mute, independent narration/music, transforms, or multi-track information.
- The browser adapter warns when exporting a Python job would lose this data.

## Compared To The Future Full Renderer

| Capability | Current MediaRecorderRenderer | Future WebCodecsRenderer |
|---|---|---|
| Pure browser export | Yes | Yes |
| WebM export | Yes | Yes |
| MP4 export | No | Target capability |
| H.264/AAC control | No | Target capability where browser supports it |
| Faster-than-realtime export | No | Target capability |
| Frame-accurate scheduling | No | Target capability |
| Multiple audio tracks | Basic narration/music | More general timeline audio |
| Audio/video sync | Best-effort | Stronger timestamp control |
| Multiple video tracks | No | Future capability |
| Transforms/overlays | Preview/export not yet | Future capability |
| Transitions/effects | No | Future capability |
| Muxing control | Browser-controlled MediaRecorder | Explicit muxer such as Mediabunny |
| Large-file behavior | Browser-element limited | Streaming-oriented target |

## Practical Test Expectations

Good MVP tests:

- Import several short video clips.
- Reorder clips manually.
- Trim starts/ends.
- Mute original video audio.
- Add one narration file.
- Add one music file.
- Adjust narration/music volume.
- Export WebM.
- Confirm the exported WebM plays locally.
- Export project JSON.
- Export Python job JSON and inspect compatibility warnings.

Tests that should wait for the full renderer:

- MP4 export.
- Exact frame boundary validation.
- Long 4K timelines.
- Complex multi-layer visual timelines.
- Professional audio mix/fades/ducking.
- Subtitle/text burn-in.
- Browser-to-browser identical output.
