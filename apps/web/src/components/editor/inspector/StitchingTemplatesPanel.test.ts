import type { MediaItem, Project } from "@openreel/core";
import { describe, expect, it } from "vitest";
import { applySalesPitchTemplate } from "./StitchingTemplatesPanel";

describe("applySalesPitchTemplate", () => {
  it("fits user video segments to their paired AI audio durations", () => {
    const project = createProject([
      createMedia("ai-opening", "opening.mp4", "video", 4.2),
      createMedia("user-first", "user-first.mp4", "video", 7.3),
      createMedia("ai-middle", "middle.mp4", "video", 14.09),
      createMedia("user-second", "user-second.mp4", "video", 6.1),
      createMedia("ai-closing", "closing.mp4", "video", 3.8),
      createMedia("audio-first", "first.mp3", "audio", 8.4),
      createMedia("audio-second", "second.mp3", "audio", 5.5),
    ]);

    const nextProject = applySalesPitchTemplate(project, {
      "ai-video-opening": "ai-opening",
      "user-video-first": "user-first",
      "ai-video-middle": "ai-middle",
      "user-video-second": "user-second",
      "ai-video-closing": "ai-closing",
      "ai-audio-first": "audio-first",
      "ai-audio-second": "audio-second",
    });

    const videoTrack = nextProject.timeline.tracks.find(
      (track) => track.type === "video",
    );
    const audioTrack = nextProject.timeline.tracks.find(
      (track) => track.type === "audio",
    );
    expect(videoTrack).toBeDefined();
    expect(audioTrack).toBeDefined();

    const videoClips = videoTrack?.clips ?? [];
    expect(videoClips.map((clip) => clip.startTime)).toEqual([
      0, 4.117, 12.517, 26.524, 32.024,
    ]);
    expect(videoClips.map((clip) => clip.duration)).toEqual([
      4.117, 8.4, 14.007, 5.5, 3.717,
    ]);
    expect(videoClips.map((clip) => clip.outPoint)).toEqual([
      4.117, 7.3, 14.007, 6.1, 3.717,
    ]);
    expect(videoClips.map((clip) => clip.speed ?? 1)).toEqual([
      1, 0.869048, 1, 1.109091, 1,
    ]);
    expect(videoClips.map((clip) => clip.volume)).toEqual([1, 0, 1, 0, 1]);

    const audioClips = audioTrack?.clips ?? [];
    expect(audioClips.map((clip) => clip.startTime)).toEqual([4.117, 26.524]);
    expect(audioClips.map((clip) => clip.duration)).toEqual([8.4, 5.5]);
    expect(
      audioClips.map((clip) =>
        Number((clip.startTime + clip.duration).toFixed(3)),
      ),
    ).toEqual([
      Number((videoClips[1].startTime + videoClips[1].duration).toFixed(3)),
      Number((videoClips[3].startTime + videoClips[3].duration).toFixed(3)),
    ]);
    expect(nextProject.timeline.duration).toBe(35.741);
  });

  it("can keep AI video tails when trimming is disabled", () => {
    const project = createProject([
      createMedia("ai-opening", "opening.mp4", "video", 4.2),
      createMedia("user-first", "user-first.mp4", "video", 7.3),
      createMedia("ai-middle", "middle.mp4", "video", 14.09),
      createMedia("user-second", "user-second.mp4", "video", 6.1),
      createMedia("ai-closing", "closing.mp4", "video", 3.8),
      createMedia("audio-first", "first.mp3", "audio", 8.4),
      createMedia("audio-second", "second.mp3", "audio", 5.5),
    ]);

    const nextProject = applySalesPitchTemplate(
      project,
      {
        "ai-video-opening": "ai-opening",
        "user-video-first": "user-first",
        "ai-video-middle": "ai-middle",
        "user-video-second": "user-second",
        "ai-video-closing": "ai-closing",
        "ai-audio-first": "audio-first",
        "ai-audio-second": "audio-second",
      },
      { trimAiVideoTailFrames: 0 },
    );

    const videoTrack = nextProject.timeline.tracks.find(
      (track) => track.type === "video",
    );
    const videoClips = videoTrack?.clips ?? [];

    expect(videoClips.map((clip) => clip.startTime)).toEqual([
      0, 4.2, 12.6, 26.69, 32.19,
    ]);
    expect(videoClips.map((clip) => clip.duration)).toEqual([
      4.2, 8.4, 14.09, 5.5, 3.8,
    ]);
    expect(videoClips.map((clip) => clip.outPoint)).toEqual([
      4.2, 7.3, 14.09, 6.1, 3.8,
    ]);
    expect(nextProject.timeline.duration).toBe(35.99);
  });

  it("fits optional background music to the appended video duration", () => {
    const project = createProject([
      createMedia("ai-opening", "opening.mp4", "video", 4.2),
      createMedia("user-first", "user-first.mp4", "video", 7.3),
      createMedia("ai-middle", "middle.mp4", "video", 14.09),
      createMedia("user-second", "user-second.mp4", "video", 6.1),
      createMedia("ai-closing", "closing.mp4", "video", 3.8),
      createMedia("audio-first", "first.mp3", "audio", 8.4),
      createMedia("audio-second", "second.mp3", "audio", 5.5),
      createMedia("bgm", "music.mp3", "audio", 10),
    ]);

    const nextProject = applySalesPitchTemplate(
      project,
      {
        "ai-video-opening": "ai-opening",
        "user-video-first": "user-first",
        "ai-video-middle": "ai-middle",
        "user-video-second": "user-second",
        "ai-video-closing": "ai-closing",
        "ai-audio-first": "audio-first",
        "ai-audio-second": "audio-second",
      },
      { backgroundMusicMediaId: "bgm" },
    );

    const bgmTrack = nextProject.timeline.tracks.find(
      (track) => track.type === "audio" && track.name === "Background Music",
    );

    expect(bgmTrack).toBeDefined();
    expect(bgmTrack?.clips.map((clip) => clip.startTime)).toEqual([
      0, 10, 20, 30,
    ]);
    expect(bgmTrack?.clips.map((clip) => clip.duration)).toEqual([
      10, 10, 10, 5.741,
    ]);
    expect(bgmTrack?.clips.map((clip) => clip.outPoint)).toEqual([
      10, 10, 10, 5.741,
    ]);
    expect(nextProject.timeline.duration).toBe(35.741);
  });
});

function createProject(mediaItems: MediaItem[]): Project {
  return {
    id: "project-1",
    name: "Project",
    createdAt: 1,
    modifiedAt: 1,
    settings: {
      width: 1920,
      height: 1080,
      frameRate: 24,
      sampleRate: 48000,
      channels: 2,
    },
    mediaLibrary: { items: mediaItems },
    timeline: {
      tracks: [],
      subtitles: [],
      duration: 0,
      markers: [],
    },
  };
}

function createMedia(
  id: string,
  name: string,
  type: MediaItem["type"],
  duration: number,
): MediaItem {
  return {
    id,
    name,
    type,
    fileHandle: null,
    blob: null,
    metadata: {
      duration,
      width: type === "audio" ? 0 : 1920,
      height: type === "audio" ? 0 : 1080,
      frameRate: type === "audio" ? 0 : 24,
      codec: "",
      sampleRate: type === "audio" ? 48000 : 0,
      channels: type === "audio" ? 2 : 0,
      fileSize: 1024,
    },
    thumbnailUrl: null,
    waveformData: null,
  };
}
