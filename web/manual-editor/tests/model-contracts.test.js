import assert from "node:assert/strict";
import { buildPipelineJob } from "../adapters/pipeline-job-adapter.js";
import { buildEditorProject } from "../model/project.js";
import { buildRendererTimeline } from "../model/timeline-ir.js";

const assets = [
  {
    id: "video_asset",
    kind: "video",
    name: "scene.mp4",
    duration: 10,
    width: 1280,
    height: 720,
    url: "blob:video",
    file: { name: "scene.mp4" },
  },
  {
    id: "narration_asset",
    kind: "audio",
    name: "narration.wav",
    duration: 8,
    width: 0,
    height: 0,
    url: "blob:narration",
    file: { name: "narration.wav" },
  },
  {
    id: "music_asset",
    kind: "audio",
    name: "music.wav",
    duration: 20,
    width: 0,
    height: 0,
    url: "blob:music",
    file: { name: "music.wav" },
  },
];

const timeline = [
  {
    id: "clip_1",
    assetId: "video_asset",
    name: "Scene",
    role: "main",
    start: 1,
    end: 7,
    muted: true,
    transform: {
      x: 12,
      y: -8,
      scale: 1.25,
      rotation: 5,
      opacity: 0.8,
    },
  },
];

const audioTracks = {
  narration: {
    id: "narration_track",
    role: "narration",
    volume: 1,
    clips: [
      {
        id: "narration_clip",
        assetId: "narration_asset",
        name: "Narration",
        timelineStart: 0,
        sourceStart: 0,
        duration: 6,
        volume: 1,
      },
    ],
  },
  music: {
    id: "music_track",
    role: "music",
    volume: 0.35,
    clips: [
      {
        id: "music_clip",
        assetId: "music_asset",
        name: "Music",
        timelineStart: 0,
        sourceStart: 4,
        duration: 9,
        volume: 0.35,
      },
    ],
  },
};

const project = buildEditorProject({ assets, timeline, audioTracks });
assert.equal(project.schema, "browser-video-editor-project");
assert.equal(project.assets.length, 3);
assert.equal(project.timeline.videoTracks[0].clips[0].muted, true);
assert.equal(project.timeline.videoTracks[0].clips[0].transform.scale, 1.25);
assert.equal(project.timeline.audioTracks.length, 2);
assert.equal(project.timeline.duration, 9);

const { ir, errors, warnings } = buildRendererTimeline({ assets, timeline, audioTracks });
assert.deepEqual(errors, []);
assert.deepEqual(warnings, []);
assert.equal(ir.schema, "renderer-timeline-ir");
assert.equal(ir.tracks.length, 3);
assert.equal(ir.duration, 9);
assert.equal(ir.assets.video_asset.objectUrl, "blob:video");
assert.equal(ir.tracks[0].clips[0].transform.rotation, 5);

const { job, warnings: jobWarnings } = buildPipelineJob({ assets, timeline, audioTracks });
assert.equal(job.mode, "timeline_assembly");
assert.equal(job.clips[0].trim_start, 1);
assert.equal(job.clips[0].muted, true);
assert.ok(jobWarnings.some((warning) => warning.includes("Independent narration/music")));
assert.ok(jobWarnings.some((warning) => warning.includes("trim data")));
assert.ok(jobWarnings.some((warning) => warning.includes("muted")));
