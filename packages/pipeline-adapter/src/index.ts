import type { Clip, MediaItem, Project, ProjectSettings, Track, Transform } from "@openreel/core";
import { inferCarSalesSection } from "@car-sales-video/workflow";

export interface PipelineClipInput {
  readonly clip_id?: string;
  readonly path: string;
  readonly role?: string;
  readonly order?: number;
  readonly timeline_start?: number;
  readonly track_index?: number;
  readonly trim_start?: number;
  readonly trim_end?: number;
  readonly duration?: number;
  readonly muted?: boolean;
  readonly hidden?: boolean;
  readonly width?: number;
  readonly height?: number;
  readonly fps?: number;
  readonly confidence?: number;
}

export interface PipelineJobInput {
  readonly job_id?: string;
  readonly mode?: string;
  readonly clips: readonly PipelineClipInput[];
  readonly predicted_order?: readonly string[];
  readonly settings?: {
    readonly resolution?: string;
    readonly fps?: number;
  };
}

export interface PipelineAdapterOptions {
  readonly projectId?: string;
  readonly projectName?: string;
  readonly defaultClipDurationSeconds?: number;
  readonly createdAt?: number;
}

export function pipelineJobToOpenReelProject(
  job: PipelineJobInput,
  options: PipelineAdapterOptions = {},
): Project {
  const createdAt = options.createdAt ?? Date.now();
  const settings = buildProjectSettings(job);
  const orderedClips = orderPipelineClips(job);
  const mediaItems = orderedClips.map((clip, index) => buildMediaItem(clip, index, settings));
  const tracks = buildTracks(orderedClips, options.defaultClipDurationSeconds ?? 5);
  const timelineClipStarts = new Map(
    tracks.flatMap((track) => track.clips.map((clip) => [clip.id, clip.startTime] as const)),
  );
  const duration = tracks.reduce((max, track) => {
    const trackEnd = track.clips.reduce(
      (clipMax, clip) => Math.max(clipMax, clip.startTime + clip.duration),
      0,
    );
    return Math.max(max, trackEnd);
  }, 0);

  return {
    id: options.projectId ?? job.job_id ?? `pipeline-${createdAt}`,
    name: options.projectName ?? "AI car sales pitch draft",
    createdAt,
    modifiedAt: createdAt,
    settings,
    mediaLibrary: {
      items: mediaItems,
    },
    timeline: {
      tracks,
      subtitles: [],
      duration,
      markers: orderedClips.map((clip, index) => ({
        id: `marker-${clip.clip_id ?? index + 1}`,
        time: timelineClipStarts.get(clip.clip_id ?? `clip-${index + 1}`) ?? 0,
        label: inferCarSalesSection(clip.role),
        color: "#f59e0b",
      })),
    },
  };
}

function orderPipelineClips(job: PipelineJobInput): readonly PipelineClipInput[] {
  if (job.predicted_order?.length) {
    const byId = new Map(job.clips.map((clip) => [clip.clip_id, clip]));
    const predicted = job.predicted_order
      .map((clipId) => byId.get(clipId))
      .filter((clip): clip is PipelineClipInput => Boolean(clip));
    const remaining = job.clips.filter((clip) => !clip.clip_id || !job.predicted_order?.includes(clip.clip_id));
    return [...predicted, ...remaining];
  }

  return [...job.clips].sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.path.localeCompare(right.path);
  });
}

function buildTracks(clips: readonly PipelineClipInput[], defaultDuration: number): Track[] {
  const clipsByTrack = new Map<number, Clip[]>();
  const nextStartByTrack = new Map<number, number>();

  clips.forEach((clip, index) => {
    const trackIndex = Math.max(0, Math.floor(clip.track_index ?? 0));
    const trackId = `video-track-${trackIndex + 1}`;
    const duration = clipDuration(clip, defaultDuration);
    const startTime = clip.timeline_start ?? nextStartByTrack.get(trackIndex) ?? 0;

    if (!clipsByTrack.has(trackIndex)) clipsByTrack.set(trackIndex, []);
    clipsByTrack.get(trackIndex)!.push({
      id: clip.clip_id ?? `clip-${index + 1}`,
      mediaId: mediaIdForClip(clip, index),
      trackId,
      startTime,
      duration,
      inPoint: clip.trim_start ?? 0,
      outPoint: (clip.trim_start ?? 0) + duration,
      effects: [],
      audioEffects: [],
      transform: defaultTransform(),
      volume: clip.muted ? 0 : 1,
      fade: { fadeIn: 0, fadeOut: 0 },
      keyframes: [],
      metadata: {
        pipelineClipId: clip.clip_id,
        sourcePath: clip.path,
        role: clip.role,
        carSalesSection: inferCarSalesSection(clip.role),
        confidence: clip.confidence,
        hidden: clip.hidden ?? false,
      },
    });

    nextStartByTrack.set(trackIndex, startTime + duration);
  });

  return [...clipsByTrack.entries()]
    .sort(([left], [right]) => left - right)
    .map(([trackIndex, trackClips]) => ({
      id: `video-track-${trackIndex + 1}`,
      type: "video",
      name: trackIndex === 0 ? "AI sales sequence" : `AI overlay ${trackIndex}`,
      clips: trackClips.sort((left, right) => left.startTime - right.startTime),
      transitions: [],
      locked: false,
      hidden: false,
      muted: false,
      solo: false,
    }));
}

function buildMediaItem(clip: PipelineClipInput, index: number, settings: ProjectSettings): MediaItem {
  const name = fileNameFromPath(clip.path);

  return {
    id: mediaIdForClip(clip, index),
    name,
    type: "video",
    fileHandle: null,
    blob: null,
    metadata: {
      duration: clipDuration(clip, 5),
      width: clip.width ?? settings.width,
      height: clip.height ?? settings.height,
      frameRate: clip.fps ?? settings.frameRate,
      codec: "unknown",
      sampleRate: settings.sampleRate,
      channels: settings.channels,
      fileSize: 0,
    },
    thumbnailUrl: null,
    waveformData: null,
    isPlaceholder: true,
    sourceFile: {
      name,
      size: 0,
      lastModified: 0,
    },
    originalUrl: clip.path,
  };
}

function buildProjectSettings(job: PipelineJobInput): ProjectSettings {
  const [width, height] = parseResolution(job.settings?.resolution);

  return {
    width,
    height,
    frameRate: job.settings?.fps ?? 30,
    sampleRate: 48000,
    channels: 2,
  };
}

function clipDuration(clip: PipelineClipInput, fallback: number): number {
  if (Number.isFinite(clip.duration) && Number(clip.duration) > 0) return Number(clip.duration);
  if (Number.isFinite(clip.trim_end) && Number.isFinite(clip.trim_start)) {
    return Math.max(0.01, Number(clip.trim_end) - Number(clip.trim_start));
  }
  return fallback;
}

function mediaIdForClip(clip: PipelineClipInput, index: number): string {
  return `media-${clip.clip_id ?? index + 1}`;
}

function defaultTransform(): Transform {
  return {
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    anchor: { x: 0.5, y: 0.5 },
    opacity: 1,
    fitMode: "contain",
  };
}

function parseResolution(resolution?: string): [number, number] {
  const match = resolution?.match(/^(\d+)x(\d+)$/i);
  if (!match) return [1280, 720];
  return [Number(match[1]), Number(match[2])];
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}
