import type { Clip, MediaItem, Project, Track } from "@openreel/core";
import {
  buildDynaudnormFilter,
  getFFmpegFallback,
  type DynaudnormFilterOptions,
} from "@openreel/core/media";
import { saveMediaBlob } from "./media-storage";
import {
  loadClipAudioBuffer,
  measureClipLoudness,
  type LoudnessMeasurement,
} from "./loudness-matching";
import { useProjectStore } from "../stores/project-store";

const AUDIO_TRACK_NAME = "Audio 1";
const DEFAULT_WAVEFORM_SAMPLES_PER_SECOND = 100;

export const DEFAULT_VOLUME_LEVELING_FILTER_OPTIONS: Required<DynaudnormFilterOptions> =
  {
    frameLengthMs: 250,
    gaussianSize: 15,
    peakValue: 0.9,
    maxGain: 6,
  };

export interface VolumeLevelingTarget {
  clip: Clip;
  track: Track;
  mediaItem: MediaItem;
  source: "timeline" | "template-ai" | "template-user" | "template-bgm";
  slotId?: string;
  slotLabel: string;
}

export interface ProcessedVolumeLevelingTarget {
  target: VolumeLevelingTarget;
  mediaItem: MediaItem;
  beforeMeasurement?: LoudnessMeasurement;
  afterMeasurement?: LoudnessMeasurement;
  filter: string;
  appliedAt: number;
}

export interface VolumeLevelingSummary {
  processed: number;
  skipped: number;
  failed: number;
  failures: Array<{ clipName: string; message: string }>;
  project: Project;
}

export interface TimelineVolumeLevelingOptions {
  clipIds?: string[];
  includeAlreadyLeveled?: boolean;
  filterOptions?: DynaudnormFilterOptions;
}

export type SalesPitchVolumeLevelingOptions = TimelineVolumeLevelingOptions;

export function getTimelineVolumeLevelingTargets(
  project: Project,
  options: TimelineVolumeLevelingOptions = {},
): VolumeLevelingTarget[] {
  const mediaById = new Map(
    project.mediaLibrary.items.map((item) => [item.id, item]),
  );
  const clipIds = options.clipIds ? new Set(options.clipIds) : null;

  return project.timeline.tracks
    .filter(
      (track) =>
        (track.type === "audio" || track.type === "video") &&
        !track.hidden &&
        !track.muted,
    )
    .flatMap((track) =>
      track.clips.flatMap((clip): VolumeLevelingTarget[] => {
        if (clipIds && !clipIds.has(clip.id)) {
          return [];
        }
        if (
          clip.volume <= 0 ||
          (!options.includeAlreadyLeveled && getVolumeLevelingMetadata(clip))
        ) {
          return [];
        }

        const mediaItem = mediaById.get(clip.mediaId);
        if (!mediaItem?.blob) {
          return [];
        }

        if (mediaItem.type !== "audio" && !isAudioBearingVideo(mediaItem)) {
          return [];
        }

        const template = getTemplateMetadata(clip);
        return [
          {
            clip,
            track,
            mediaItem,
            source: getVolumeLevelingTargetSource(template),
            slotId: template?.slotId,
            slotLabel: template?.label ?? mediaItem.name,
          },
        ];
      }),
    );
}

export function getSalesPitchVolumeLevelingTargets(
  project: Project,
  options: SalesPitchVolumeLevelingOptions = {},
): VolumeLevelingTarget[] {
  return getTimelineVolumeLevelingTargets(project, options);
}

export async function applyTimelineVolumeLeveling(
  project: Project,
  options: TimelineVolumeLevelingOptions = {},
): Promise<VolumeLevelingSummary> {
  const targets = getTimelineVolumeLevelingTargets(project, options);
  if (targets.length === 0) {
    return {
      processed: 0,
      skipped: 0,
      failed: 0,
      failures: [],
      project,
    };
  }

  const ffmpeg = getFFmpegFallback();
  const supportsDynaudnorm = await ffmpeg.hasAudioFilter("dynaudnorm");
  if (!supportsDynaudnorm) {
    throw new Error("This FFmpeg build does not include dynaudnorm.");
  }

  const filterOptions = {
    ...DEFAULT_VOLUME_LEVELING_FILTER_OPTIONS,
    ...options.filterOptions,
  };
  const filter = buildDynaudnormFilter(filterOptions);
  const processedTargets: ProcessedVolumeLevelingTarget[] = [];
  const failures: VolumeLevelingSummary["failures"] = [];

  for (const target of targets) {
    try {
      const beforeMeasurement = await measureTargetSafely(target);
      const leveledBlob = await ffmpeg.levelAudioWithDynaudnorm(
        target.mediaItem.blob!,
        {
          audioTrackIndex: target.clip.audioTrackIndex ?? 0,
          startTime: Math.max(0, target.clip.inPoint ?? 0),
          duration: target.clip.duration,
          filterOptions,
        },
      );
      const mediaItem = await createLeveledMediaItem(
        target,
        leveledBlob,
        filter,
      );
      const afterMeasurement = await measureProcessedMediaSafely(
        mediaItem,
        target.clip.duration,
      );

      processedTargets.push({
        target,
        mediaItem,
        beforeMeasurement,
        afterMeasurement,
        filter,
        appliedAt: Date.now(),
      });
    } catch (error) {
      failures.push({
        clipName: target.mediaItem.name,
        message:
          error instanceof Error ? error.message : "Could not level this clip.",
      });
    }
  }

  if (processedTargets.length === 0) {
    return {
      processed: 0,
      skipped: 0,
      failed: failures.length,
      failures,
      project,
    };
  }

  const currentProject = useProjectStore.getState().project;
  const nextProject = applyVolumeLevelingResultsToProject(
    currentProject,
    processedTargets,
  );
  useProjectStore.setState({ project: nextProject });

  const processingFailureCount = failures.length;
  const persistenceResults = await Promise.allSettled(
    processedTargets.map(({ mediaItem }) =>
      mediaItem.blob
        ? saveMediaBlob(
            nextProject.id,
            mediaItem.id,
            mediaItem.blob,
            mediaItem.metadata,
          )
        : Promise.resolve(),
    ),
  );
  persistenceResults.forEach((result, index) => {
    if (result.status === "fulfilled") return;
    const processed = processedTargets[index];
    failures.push({
      clipName: processed?.mediaItem.name ?? "Processed audio",
      message:
        result.reason instanceof Error
          ? `Processed audio could not be persisted: ${result.reason.message}`
          : "Processed audio could not be persisted.",
    });
  });

  return {
    processed: processedTargets.length,
    skipped: targets.length - processedTargets.length - processingFailureCount,
    failed: failures.length,
    failures,
    project: nextProject,
  };
}

export async function applySalesPitchTemplateVolumeLeveling(
  project: Project,
  options: SalesPitchVolumeLevelingOptions = {},
): Promise<VolumeLevelingSummary> {
  return applyTimelineVolumeLeveling(project, options);
}

export function applyVolumeLevelingResultsToProject(
  project: Project,
  processedTargets: ProcessedVolumeLevelingTarget[],
): Project {
  if (processedTargets.length === 0) return project;

  const processedByClipId = new Map(
    processedTargets.map((result) => [result.target.clip.id, result]),
  );
  const existingMediaIds = new Set(
    project.mediaLibrary.items.map((item) => item.id),
  );
  const mediaItemsToAdd = processedTargets
    .map((result) => result.mediaItem)
    .filter((item) => !existingMediaIds.has(item.id));

  let audioTrack =
    project.timeline.tracks.find(
      (track) => track.type === "audio" && track.name === AUDIO_TRACK_NAME,
    ) ?? project.timeline.tracks.find((track) => track.type === "audio");
  const audioTrackId = audioTrack?.id ?? createId();
  const generatedAudioClips: Clip[] = [];

  const tracks = project.timeline.tracks.map((track) => {
    const clips = track.clips.map((clip) => {
      const processed = processedByClipId.get(clip.id);
      if (!processed) return clip;

      const metadata = createVolumeLevelingMetadata(processed);
      if (track.type === "audio") {
        return {
          ...clip,
          mediaId: processed.mediaItem.id,
          inPoint: 0,
          outPoint: roundDuration(clip.duration),
          volume: 1,
          metadata: {
            ...(clip.metadata ?? {}),
            volumeLeveling: metadata,
          },
        };
      }

      generatedAudioClips.push(
        createLeveledAudioClip(processed, audioTrackId, metadata),
      );

      return {
        ...clip,
        volume: 0,
        metadata: {
          ...(clip.metadata ?? {}),
          volumeLeveling: {
            ...metadata,
            mode: "separated-audio",
          },
        },
      };
    });

    return { ...track, clips };
  });

  if (generatedAudioClips.length > 0) {
    const audioTrackIndex = tracks.findIndex(
      (track) => track.id === audioTrackId,
    );
    if (audioTrackIndex === -1) {
      audioTrack = {
        id: audioTrackId,
        type: "audio",
        name: AUDIO_TRACK_NAME,
        clips: generatedAudioClips.sort(
          (left, right) => left.startTime - right.startTime,
        ),
        transitions: [],
        locked: false,
        hidden: false,
        muted: false,
        solo: false,
      };
      const firstVideoTrackIndex = tracks.findIndex(
        (track) => track.type === "video",
      );
      tracks.splice(
        firstVideoTrackIndex === -1 ? tracks.length : firstVideoTrackIndex + 1,
        0,
        audioTrack,
      );
    } else {
      const targetTrack = tracks[audioTrackIndex];
      tracks[audioTrackIndex] = {
        ...targetTrack,
        clips: [...targetTrack.clips, ...generatedAudioClips].sort(
          (left, right) => left.startTime - right.startTime,
        ),
      };
    }
  }

  return {
    ...project,
    mediaLibrary: {
      ...project.mediaLibrary,
      items: [...project.mediaLibrary.items, ...mediaItemsToAdd],
    },
    timeline: {
      ...project.timeline,
      tracks,
      duration: Math.max(
        project.timeline.duration,
        getTimelineDuration(tracks),
      ),
    },
    modifiedAt: Date.now(),
  };
}

async function createLeveledMediaItem(
  target: VolumeLevelingTarget,
  blob: Blob,
  filter: string,
): Promise<MediaItem> {
  const audioBuffer = await decodeAudioBlob(blob);
  const mediaId = createId();
  const fileName = `${stripExtension(target.mediaItem.name)}-leveled.wav`;
  const file =
    typeof File !== "undefined"
      ? new File([blob], fileName, {
          type: "audio/wav",
          lastModified: Date.now(),
        })
      : blob;

  return {
    id: mediaId,
    name: fileName,
    type: "audio",
    fileHandle: null,
    blob: file,
    metadata: {
      duration: roundDuration(audioBuffer.duration || target.clip.duration),
      width: 0,
      height: 0,
      frameRate: 0,
      codec: "pcm_f32le",
      sampleRate: audioBuffer.sampleRate || 48000,
      channels: audioBuffer.numberOfChannels || 2,
      fileSize: blob.size,
    },
    thumbnailUrl: null,
    waveformData: createWaveformPeaks(audioBuffer),
    sourceFile: {
      name: fileName,
      size: blob.size,
      lastModified: Date.now(),
    },
    originalUrl: `volume-leveling:${target.mediaItem.id}:${target.clip.id}:${filter}`,
  };
}

async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const AudioContextCtor =
    globalThis.AudioContext ??
    (
      globalThis as typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("This browser does not support audio decoding.");
  }

  const context = new AudioContextCtor();
  try {
    return await context.decodeAudioData(await blob.arrayBuffer());
  } finally {
    if ("close" in context) {
      void context.close();
    }
  }
}

async function measureTargetSafely(
  target: VolumeLevelingTarget,
): Promise<LoudnessMeasurement | undefined> {
  try {
    const buffer = await loadClipAudioBuffer(target.mediaItem, target.clip);
    return await measureClipLoudness(buffer);
  } catch {
    return undefined;
  }
}

async function measureProcessedMediaSafely(
  mediaItem: MediaItem,
  duration: number,
): Promise<LoudnessMeasurement | undefined> {
  try {
    const clip: Clip = {
      id: createId(),
      mediaId: mediaItem.id,
      trackId: "measurement",
      startTime: 0,
      duration,
      inPoint: 0,
      outPoint: duration,
      effects: [],
      audioEffects: [],
      transform: createDefaultTransform(),
      volume: 1,
      keyframes: [],
    };
    const buffer = await loadClipAudioBuffer(mediaItem, clip);
    return await measureClipLoudness(buffer);
  } catch {
    return undefined;
  }
}

function createLeveledAudioClip(
  processed: ProcessedVolumeLevelingTarget,
  trackId: string,
  volumeLeveling: Record<string, unknown>,
): Clip {
  const sourceClip = processed.target.clip;
  const templateMetadata = getTemplateMetadata(sourceClip);
  const duration = roundDuration(sourceClip.duration);

  return {
    id: createId(),
    mediaId: processed.mediaItem.id,
    trackId,
    startTime: sourceClip.startTime,
    duration,
    inPoint: 0,
    outPoint: duration,
    effects: [],
    audioEffects: [],
    transform: createDefaultTransform(),
    volume: 1,
    keyframes: [],
    metadata: {
      ...(templateMetadata
        ? {
            stitchingTemplate: {
              ...templateMetadata,
              label: `${processed.target.slotLabel} leveled audio`,
              leveledFromClipId: sourceClip.id,
            },
          }
        : {}),
      volumeLeveling,
    },
  };
}

function createVolumeLevelingMetadata(
  processed: ProcessedVolumeLevelingTarget,
): Record<string, unknown> {
  return {
    engine: "ffmpeg-dynaudnorm",
    sourceClipId: processed.target.clip.id,
    sourceMediaId: processed.target.mediaItem.id,
    leveledMediaId: processed.mediaItem.id,
    filter: processed.filter,
    beforeIntegratedLufs: processed.beforeMeasurement?.integratedLufs,
    afterIntegratedLufs: processed.afterMeasurement?.integratedLufs,
    beforeTruePeakDbtp: processed.beforeMeasurement?.truePeakDbtp,
    afterTruePeakDbtp: processed.afterMeasurement?.truePeakDbtp,
    appliedAt: processed.appliedAt,
  };
}

function createDefaultTransform(): Clip["transform"] {
  return {
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    anchor: { x: 0.5, y: 0.5 },
    opacity: 1,
    fitMode: "contain",
  };
}

function createWaveformPeaks(
  buffer: AudioBuffer,
  samplesPerSecond = DEFAULT_WAVEFORM_SAMPLES_PER_SECOND,
): Float32Array {
  const sampleCount = Math.max(
    1,
    Math.ceil(buffer.duration * samplesPerSecond),
  );
  const peaks = new Float32Array(sampleCount);
  const framesPerSample = Math.max(
    1,
    Math.floor(buffer.sampleRate / samplesPerSecond),
  );

  for (let index = 0; index < sampleCount; index += 1) {
    const startFrame = index * framesPerSample;
    const endFrame = Math.min(buffer.length, startFrame + framesPerSample);
    let peak = 0;

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let frame = startFrame; frame < endFrame; frame += 1) {
        peak = Math.max(peak, Math.abs(data[frame] ?? 0));
      }
    }

    peaks[index] = peak;
  }

  return peaks;
}

function getTemplateMetadata(clip: Clip): {
  templateId: string;
  slotId: string;
  label: string;
  source: string;
  [key: string]: unknown;
} | null {
  const metadata = clip.metadata?.stitchingTemplate;
  if (!metadata || typeof metadata !== "object") return null;
  const candidate = metadata as Record<string, unknown>;
  if (
    typeof candidate.templateId !== "string" ||
    typeof candidate.slotId !== "string" ||
    typeof candidate.label !== "string" ||
    typeof candidate.source !== "string"
  ) {
    return null;
  }
  return candidate as {
    templateId: string;
    slotId: string;
    label: string;
    source: string;
    [key: string]: unknown;
  };
}

function getVolumeLevelingTargetSource(
  template: ReturnType<typeof getTemplateMetadata>,
): VolumeLevelingTarget["source"] {
  if (!template) {
    return "timeline";
  }
  if (template.slotId === "background-music") {
    return "template-bgm";
  }
  return template.source === "ai" ? "template-ai" : "template-user";
}

function getVolumeLevelingMetadata(clip: Clip): unknown {
  return clip.metadata?.volumeLeveling;
}

function isAudioBearingVideo(mediaItem: MediaItem): boolean {
  return (
    mediaItem.type === "video" &&
    ((mediaItem.metadata.channels ?? 0) > 0 ||
      (mediaItem.metadata.audioTrackCount ?? 0) > 0)
  );
}

function getTimelineDuration(tracks: Track[]): number {
  return roundDuration(
    tracks.reduce((timelineEnd, track) => {
      const trackEnd = track.clips.reduce(
        (clipEnd, clip) => Math.max(clipEnd, clip.startTime + clip.duration),
        0,
      );
      return Math.max(timelineEnd, trackEnd);
    }, 0),
  );
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

function roundDuration(seconds: number): number {
  return Number(seconds.toFixed(3));
}

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}
