import type { Clip, MediaItem, Project, Track } from "@openreel/core";
import { describe, expect, it } from "vitest";
import {
  applyVolumeLevelingResultsToProject,
  getTimelineVolumeLevelingTargets,
  type ProcessedVolumeLevelingTarget,
} from "./volume-leveling";

const TEMPLATE_ID = "car-sales-pitch-3-ai-2-user-2-audio";

describe("volume-leveling project helpers", () => {
  it("selects all unprocessed unmuted timeline clips with audio", () => {
    const aiVideo = createMedia("ai-video", "ai-video.mp4", "video", {
      channels: 2,
    });
    const userVideo = createMedia("user-video", "user-video.mp4", "video", {
      channels: 2,
    });
    const aiAudio = createMedia("ai-audio", "ai-audio.wav", "audio", {
      channels: 2,
    });
    const bgmAudio = createMedia("bgm-audio", "bgm.wav", "audio", {
      channels: 2,
    });
    const genericAudio = createMedia(
      "generic-audio",
      "voiceover.wav",
      "audio",
      { channels: 2 },
    );
    const project = createProject(
      [aiVideo, userVideo, aiAudio, bgmAudio, genericAudio],
      [
        createTrack("video-track", "video", "Video 1", [
          createClip("ai-video-clip", "ai-video", "video-track", 0, 5, {
            source: "ai",
            slotId: "ai-video-opening",
            label: "AI opening video",
          }),
          createClip("user-video-clip", "user-video", "video-track", 5, 10, {
            source: "user",
            slotId: "user-video-first",
            label: "User walk-around video 1",
          }),
          createClip(
            "muted-user-video-clip",
            "user-video",
            "video-track",
            15,
            10,
            {
              source: "user",
              slotId: "muted-user-video",
              label: "Muted user video",
            },
            { volume: 0 },
          ),
        ]),
        createTrack("audio-track", "audio", "Audio 1", [
          createClip("ai-audio-clip", "ai-audio", "audio-track", 5, 10, {
            source: "ai",
            slotId: "ai-audio-first",
            label: "AI narration audio 1",
          }),
          createClip("bgm-clip", "bgm-audio", "audio-track", 0, 25, {
            source: "user",
            slotId: "background-music",
            label: "Optional background music",
          }),
          createClip(
            "generic-audio-clip",
            "generic-audio",
            "audio-track",
            26,
            4,
          ),
          createClip(
            "already-leveled-clip",
            "generic-audio",
            "audio-track",
            30,
            4,
            undefined,
            { leveled: true },
          ),
        ]),
      ],
    );

    const targets = getTimelineVolumeLevelingTargets(project);

    expect(targets.map((target) => target.clip.id)).toEqual([
      "ai-video-clip",
      "user-video-clip",
      "ai-audio-clip",
      "bgm-clip",
      "generic-audio-clip",
    ]);
  });

  it("mutes leveled AI video audio and adds aligned processed audio", () => {
    const sourceVideo = createMedia("ai-video", "ai-video.mp4", "video", {
      channels: 2,
    });
    const leveledAudio = createMedia(
      "leveled-audio",
      "ai-video-leveled.wav",
      "audio",
      {
        channels: 2,
      },
    );
    const videoTrack = createTrack("video-track", "video", "Video 1", [
      createClip("ai-video-clip", "ai-video", "video-track", 2, 5, {
        source: "ai",
        slotId: "ai-video-opening",
        label: "AI opening video",
      }),
    ]);
    const audioTrack = createTrack("audio-track", "audio", "Audio 1", []);
    const project = createProject([sourceVideo], [videoTrack, audioTrack]);

    const nextProject = applyVolumeLevelingResultsToProject(project, [
      createProcessedTarget(
        videoTrack.clips[0],
        videoTrack,
        sourceVideo,
        leveledAudio,
      ),
    ]);

    const nextVideoClip = nextProject.timeline.tracks
      .find((track) => track.id === "video-track")
      ?.clips.find((clip) => clip.id === "ai-video-clip");
    const generatedAudioClip = nextProject.timeline.tracks
      .find((track) => track.id === "audio-track")
      ?.clips.find((clip) => clip.mediaId === "leveled-audio");

    expect(nextVideoClip?.volume).toBe(0);
    expect(nextVideoClip?.metadata?.volumeLeveling).toMatchObject({
      engine: "ffmpeg-dynaudnorm",
      mode: "separated-audio",
      leveledMediaId: "leveled-audio",
    });
    expect(generatedAudioClip).toMatchObject({
      mediaId: "leveled-audio",
      trackId: "audio-track",
      startTime: 2,
      duration: 5,
      inPoint: 0,
      outPoint: 5,
      volume: 1,
    });
    expect(
      nextProject.mediaLibrary.items.some(
        (item) => item.id === "leveled-audio",
      ),
    ).toBe(true);
  });

  it("replaces leveled AI audio clip media in place", () => {
    const sourceAudio = createMedia("ai-audio", "ai-audio.wav", "audio", {
      channels: 2,
    });
    const leveledAudio = createMedia(
      "leveled-audio",
      "ai-audio-leveled.wav",
      "audio",
      {
        channels: 2,
      },
    );
    const audioTrack = createTrack("audio-track", "audio", "Audio 1", [
      createClip("ai-audio-clip", "ai-audio", "audio-track", 5, 10, {
        source: "ai",
        slotId: "ai-audio-first",
        label: "AI narration audio 1",
      }),
    ]);
    const project = createProject([sourceAudio], [audioTrack]);

    const nextProject = applyVolumeLevelingResultsToProject(project, [
      createProcessedTarget(
        audioTrack.clips[0],
        audioTrack,
        sourceAudio,
        leveledAudio,
      ),
    ]);

    const nextAudioClip = nextProject.timeline.tracks[0].clips[0];
    expect(nextAudioClip.mediaId).toBe("leveled-audio");
    expect(nextAudioClip.volume).toBe(1);
    expect(nextAudioClip.metadata?.volumeLeveling).toMatchObject({
      engine: "ffmpeg-dynaudnorm",
      leveledMediaId: "leveled-audio",
    });
    expect(nextProject.timeline.tracks[0].clips).toHaveLength(1);
  });
});

function createProject(mediaItems: MediaItem[], tracks: Track[]): Project {
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
      tracks,
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
  options: { channels: number },
): MediaItem {
  return {
    id,
    name,
    type,
    fileHandle: null,
    blob: new Blob(["test"], {
      type: type === "video" ? "video/mp4" : "audio/wav",
    }),
    metadata: {
      duration: 10,
      width: type === "video" ? 1920 : 0,
      height: type === "video" ? 1080 : 0,
      frameRate: type === "video" ? 24 : 0,
      codec: "",
      sampleRate: options.channels > 0 ? 48000 : 0,
      channels: options.channels,
      fileSize: 1024,
      audioTrackCount: options.channels > 0 ? 1 : 0,
    },
    thumbnailUrl: null,
    waveformData: null,
  };
}

function createTrack(
  id: string,
  type: Track["type"],
  name: string,
  clips: Clip[],
): Track {
  return {
    id,
    type,
    name,
    clips,
    transitions: [],
    locked: false,
    hidden: false,
    muted: false,
    solo: false,
  };
}

function createClip(
  id: string,
  mediaId: string,
  trackId: string,
  startTime: number,
  duration: number,
  template?: { source: string; slotId: string; label: string },
  options: { volume?: number; leveled?: boolean } = {},
): Clip {
  return {
    id,
    mediaId,
    trackId,
    startTime,
    duration,
    inPoint: 0,
    outPoint: duration,
    effects: [],
    audioEffects: [],
    transform: {
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
      anchor: { x: 0.5, y: 0.5 },
      opacity: 1,
      fitMode: "contain",
    },
    volume: options.volume ?? 1,
    keyframes: [],
    metadata: {
      ...(template
        ? {
            stitchingTemplate: {
              templateId: TEMPLATE_ID,
              slotId: template.slotId,
              label: template.label,
              source: template.source,
            },
          }
        : {}),
      ...(options.leveled
        ? {
            volumeLeveling: {
              engine: "ffmpeg-dynaudnorm",
              leveledMediaId: "old-leveled-media",
            },
          }
        : {}),
    },
  };
}

function createProcessedTarget(
  clip: Clip,
  track: Track,
  mediaItem: MediaItem,
  leveledMediaItem: MediaItem,
): ProcessedVolumeLevelingTarget {
  return {
    target: {
      clip,
      track,
      mediaItem,
      source: "template-ai",
      slotId: "ai-video-opening",
      slotLabel: "AI opening video",
    },
    mediaItem: leveledMediaItem,
    filter: "dynaudnorm=f=250:g=15:p=0.90:m=6",
    appliedAt: 100,
  };
}
