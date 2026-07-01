import React, { useMemo, useState } from "react";
import type { Clip, MediaItem, Project, Track } from "@openreel/core";
import { Check, Loader2, Upload, Wand2 } from "lucide-react";
import { toast } from "../../../stores/notification-store";
import { useProjectStore } from "../../../stores/project-store";
import { analyzeClipForLoudnessMatch } from "../../../services/loudness-matching";
import { applyTimelineVolumeLeveling } from "../../../services/volume-leveling";
import {
  clampLoudnessTarget,
  clampPeakCeiling,
} from "../../../services/loudness-matching-math";

type SlotType = "video" | "audio";
type SlotSource = "ai" | "user";

interface TemplateSlot {
  id: string;
  label: string;
  shortLabel: string;
  type: SlotType;
  source: SlotSource;
  startTime: number;
  duration: number;
  row: "video" | "audio";
  columnStart: number;
  columnSpan: number;
}

interface ResolvedTemplateSlot extends TemplateSlot {
  resolvedStartTime: number;
  resolvedDuration: number;
}

interface SalesPitchTemplateOptions {
  backgroundMusicMediaId?: string | null;
  trimAiVideoTailFrames?: number;
}

const TEMPLATE_ID = "car-sales-pitch-3-ai-2-user-2-audio";
const VIDEO_TRACK_NAME = "Video 1";
const AUDIO_TRACK_NAME = "Audio 1";
const BGM_TRACK_NAME = "Background Music";
const BACKGROUND_MUSIC_SLOT_ID = "background-music";
const DEFAULT_AI_VIDEO_TAIL_TRIM_FRAMES = 2;
const DEFAULT_TEMPLATE_TARGET_LUFS = -16;
const DEFAULT_TEMPLATE_BGM_TARGET_LUFS = -28;
const DEFAULT_TEMPLATE_PEAK_CEILING_DBTP = -1;

const VIDEO_SLOT_SEQUENCE = [
  "ai-video-opening",
  "user-video-first",
  "ai-video-middle",
  "user-video-second",
  "ai-video-closing",
] as const;

const AUDIO_SLOT_ANCHORS: Record<string, (typeof VIDEO_SLOT_SEQUENCE)[number]> =
  {
    "ai-audio-first": "user-video-first",
    "ai-audio-second": "user-video-second",
  };

const TEMPLATE_SLOTS: TemplateSlot[] = [
  {
    id: "ai-video-opening",
    label: "AI opening video",
    shortLabel: "AI Video 1",
    type: "video",
    source: "ai",
    startTime: 0,
    duration: 5,
    row: "video",
    columnStart: 1,
    columnSpan: 5,
  },
  {
    id: "user-video-first",
    label: "User walk-around video 1",
    shortLabel: "User Video 1",
    type: "video",
    source: "user",
    startTime: 5,
    duration: 10,
    row: "video",
    columnStart: 6,
    columnSpan: 10,
  },
  {
    id: "ai-video-middle",
    label: "AI middle video",
    shortLabel: "AI Video 2",
    type: "video",
    source: "ai",
    startTime: 15,
    duration: 5,
    row: "video",
    columnStart: 16,
    columnSpan: 5,
  },
  {
    id: "user-video-second",
    label: "User walk-around video 2",
    shortLabel: "User Video 2",
    type: "video",
    source: "user",
    startTime: 20,
    duration: 10,
    row: "video",
    columnStart: 21,
    columnSpan: 10,
  },
  {
    id: "ai-video-closing",
    label: "AI closing video",
    shortLabel: "AI Video 3",
    type: "video",
    source: "ai",
    startTime: 30,
    duration: 5,
    row: "video",
    columnStart: 31,
    columnSpan: 5,
  },
  {
    id: "ai-audio-first",
    label: "AI narration audio 1",
    shortLabel: "AI Audio 1",
    type: "audio",
    source: "ai",
    startTime: 5,
    duration: 10,
    row: "audio",
    columnStart: 6,
    columnSpan: 10,
  },
  {
    id: "ai-audio-second",
    label: "AI narration audio 2",
    shortLabel: "AI Audio 2",
    type: "audio",
    source: "ai",
    startTime: 20,
    duration: 10,
    row: "audio",
    columnStart: 21,
    columnSpan: 10,
  },
];

const BACKGROUND_MUSIC_SLOT: TemplateSlot = {
  id: BACKGROUND_MUSIC_SLOT_ID,
  label: "Optional background music",
  shortLabel: "BGM",
  type: "audio",
  source: "user",
  startTime: 0,
  duration: 35,
  row: "audio",
  columnStart: 1,
  columnSpan: 35,
};

export const StitchingTemplatesPanel: React.FC = () => {
  const project = useProjectStore((state) => state.project);
  const importMedia = useProjectStore((state) => state.importMedia);
  const [slotMediaIds, setSlotMediaIds] = useState<Record<string, string>>({});
  const [backgroundMusicMediaId, setBackgroundMusicMediaId] = useState<
    string | null
  >(null);
  const [trimAiVideoTails, setTrimAiVideoTails] = useState(true);
  const [levelTimelineAudio, setLevelTimelineAudio] = useState(true);
  const [importingSlotId, setImportingSlotId] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const mediaById = useMemo(
    () => new Map(project.mediaLibrary.items.map((item) => [item.id, item])),
    [project.mediaLibrary.items],
  );

  const filledSlots = TEMPLATE_SLOTS.filter(
    (slot) => slotMediaIds[slot.id],
  ).length;
  const canApply =
    filledSlots === TEMPLATE_SLOTS.length &&
    importingSlotId === null &&
    !isApplying;

  const handleSlotFile = async (
    slot: TemplateSlot,
    file: File | undefined,
    options?: { optionalBackgroundMusic?: boolean },
  ) => {
    if (!file) return;

    const acceptMatches =
      slot.type === "video"
        ? file.type.startsWith("video/")
        : file.type.startsWith("audio/");
    if (!acceptMatches) {
      toast.warning(
        "Wrong media type",
        `${slot.label} expects a ${slot.type} file.`,
      );
      return;
    }

    setImportingSlotId(slot.id);
    const beforeIds = new Set(
      useProjectStore
        .getState()
        .project.mediaLibrary.items.map((item) => item.id),
    );

    try {
      const result = await importMedia(file);
      if (!result.success) {
        toast.error(
          "Import failed",
          result.error?.message ?? "Could not import media.",
        );
        return;
      }

      const nextProject = useProjectStore.getState().project;
      const importedItem = nextProject.mediaLibrary.items.find(
        (item) => !beforeIds.has(item.id),
      );
      if (!importedItem) {
        toast.error(
          "Import failed",
          "The imported media could not be found in the library.",
        );
        return;
      }
      if (importedItem.type !== slot.type) {
        toast.warning(
          "Imported type mismatch",
          `${slot.label} expects a ${slot.type} file.`,
        );
        return;
      }

      if (options?.optionalBackgroundMusic) {
        setBackgroundMusicMediaId(importedItem.id);
      } else {
        setSlotMediaIds((current) => ({
          ...current,
          [slot.id]: importedItem.id,
        }));
      }
      toast.success(
        "Media added",
        `${importedItem.name} assigned to ${slot.label}.`,
      );
    } catch (error) {
      toast.error(
        "Import failed",
        error instanceof Error ? error.message : "Could not import media.",
      );
    } finally {
      setImportingSlotId(null);
    }
  };

  const applyTemplate = async () => {
    if (!canApply) {
      toast.warning(
        "Template incomplete",
        "Add media to all 7 template slots first.",
      );
      return;
    }

    const missing = TEMPLATE_SLOTS.find(
      (slot) => !mediaById.get(slotMediaIds[slot.id]),
    );
    if (missing) {
      toast.warning(
        "Template incomplete",
        `${missing.label} is missing media.`,
      );
      return;
    }

    setIsApplying(true);
    try {
      let appliedProject: Project | null = null;
      useProjectStore.setState((state) => {
        appliedProject = applySalesPitchTemplate(state.project, slotMediaIds, {
          backgroundMusicMediaId,
          trimAiVideoTailFrames: trimAiVideoTails
            ? DEFAULT_AI_VIDEO_TAIL_TRIM_FRAMES
            : 0,
        });
        return { project: appliedProject };
      });

      if (!appliedProject) {
        throw new Error("Could not apply the stitching template.");
      }

      toast.success(
        "Stitching template applied",
        [
          "Video clips were appended",
          trimAiVideoTails ? "AI videos were trimmed by 2 frames" : null,
          backgroundMusicMediaId ? "BGM was fitted to the video length" : null,
          levelTimelineAudio ? "timeline volume leveling is starting" : null,
          "loudness matching will follow",
        ]
          .filter(Boolean)
          .join(", ") + ".",
      );

      if (levelTimelineAudio) {
        try {
          const levelingSummary =
            await applyTimelineVolumeLeveling(appliedProject);

          if (levelingSummary.processed > 0 && levelingSummary.failed === 0) {
            toast.success(
              "Volume leveling applied",
              `${levelingSummary.processed} timeline audio clip${levelingSummary.processed === 1 ? "" : "s"} balanced before loudness matching.`,
            );
          } else if (levelingSummary.processed > 0) {
            toast.warning(
              "Volume leveling partially applied",
              `${levelingSummary.processed} clip${levelingSummary.processed === 1 ? "" : "s"} balanced; ${levelingSummary.failed} skipped. Loudness matching will continue.`,
            );
          } else if (levelingSummary.failed > 0) {
            toast.warning(
              "Volume leveling skipped",
              "Timeline audio could not be balanced, so loudness matching will continue.",
            );
          }
        } catch (error) {
          toast.warning(
            "Volume leveling unavailable",
            `${
              error instanceof Error
                ? error.message
                : "Could not run volume leveling."
            } Loudness matching will continue.`,
          );
        }
      }

      await applyTimelineLoudnessMatching(useProjectStore.getState().project);
    } catch (error) {
      toast.error(
        "Template application failed",
        error instanceof Error
          ? error.message
          : "Could not apply the sales pitch template.",
      );
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="min-h-0 space-y-4">
      <div className="rounded-xl border border-border bg-background-tertiary p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/20">
            <Wand2 size={20} className="text-orange-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary">
              Stitching Templates
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
              Car sales pitch template: 3 AI videos, 2 user videos, and 2 AI
              audio clips. Later these AI slots can be filled by API responses.
              Applying the template appends video clips by actual duration.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] text-text-muted">
            <span>Sales pitch timeline template</span>
            <span>{filledSlots}/7 filled</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-background-secondary p-3">
            <div className="min-w-[620px] space-y-2">
              <TimelineRow label="Video 1">
                {TEMPLATE_SLOTS.filter((slot) => slot.row === "video").map(
                  (slot) => (
                    <TemplateSlotButton
                      key={slot.id}
                      slot={slot}
                      mediaItem={mediaById.get(slotMediaIds[slot.id])}
                      isImporting={importingSlotId === slot.id}
                      onFile={(file) => void handleSlotFile(slot, file)}
                    />
                  ),
                )}
              </TimelineRow>
              <TimelineRow label="Audio 1">
                {TEMPLATE_SLOTS.filter((slot) => slot.row === "audio").map(
                  (slot) => (
                    <TemplateSlotButton
                      key={slot.id}
                      slot={slot}
                      mediaItem={mediaById.get(slotMediaIds[slot.id])}
                      isImporting={importingSlotId === slot.id}
                      onFile={(file) => void handleSlotFile(slot, file)}
                    />
                  ),
                )}
              </TimelineRow>
              <TimelineRow label="BGM">
                <TemplateSlotButton
                  slot={BACKGROUND_MUSIC_SLOT}
                  mediaItem={
                    backgroundMusicMediaId
                      ? mediaById.get(backgroundMusicMediaId)
                      : undefined
                  }
                  isImporting={importingSlotId === BACKGROUND_MUSIC_SLOT.id}
                  onFile={(file) =>
                    void handleSlotFile(BACKGROUND_MUSIC_SLOT, file, {
                      optionalBackgroundMusic: true,
                    })
                  }
                  helperText="Optional music bed"
                  fullWidth
                />
              </TimelineRow>
            </div>
          </div>
          <div className="grid grid-cols-5 text-[9px] text-text-muted">
            <span>00:00</span>
            <span>00:05</span>
            <span>00:15</span>
            <span>00:20</span>
            <span>00:30</span>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background-secondary px-3 py-2 text-[11px] text-text-secondary transition hover:border-primary/50">
          <input
            type="checkbox"
            checked={trimAiVideoTails}
            onChange={(event) =>
              setTrimAiVideoTails(event.currentTarget.checked)
            }
            className="mt-0.5 h-3.5 w-3.5 accent-primary"
          />
          <span className="space-y-0.5">
            <span className="block font-semibold text-text-primary">
              Trim last 2 frames from AI videos
            </span>
            <span className="block text-[10px] text-text-muted">
              Removes possible unfinished AI-model tail frames. User videos and
              audio clips are not shortened.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background-secondary px-3 py-2 text-[11px] text-text-secondary transition hover:border-primary/50">
          <input
            type="checkbox"
            checked={levelTimelineAudio}
            onChange={(event) =>
              setLevelTimelineAudio(event.currentTarget.checked)
            }
            className="mt-0.5 h-3.5 w-3.5 accent-primary"
          />
          <span className="space-y-0.5">
            <span className="block font-semibold text-text-primary">
              Apply Volume Leveling to all timeline audio
            </span>
            <span className="block text-[10px] text-text-muted">
              Balances sudden loud and quiet sections across all unmuted
              video/audio clips before timeline loudness matching.
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={applyTemplate}
          disabled={!canApply}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-[11px] font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isApplying ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} />
          )}
          {isApplying ? "Applying Template" : "Apply Sales Pitch Template"}
        </button>
      </div>
    </div>
  );
};

const TimelineRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="grid grid-cols-[64px_repeat(35,minmax(10px,1fr))] items-stretch gap-1">
    <div className="flex items-center rounded-lg bg-background-tertiary px-2 text-[10px] font-semibold text-text-secondary">
      {label}
    </div>
    {children}
  </div>
);

const TemplateSlotButton: React.FC<{
  slot: TemplateSlot;
  mediaItem: MediaItem | undefined;
  isImporting: boolean;
  onFile: (file: File | undefined) => void;
  helperText?: string;
  fullWidth?: boolean;
}> = ({
  slot,
  mediaItem,
  isImporting,
  onFile,
  helperText,
  fullWidth = false,
}) => {
  const accept = slot.type === "video" ? "video/*" : "audio/*";
  const palette = fullWidth
    ? "border-primary/60 bg-primary/15 text-orange-100"
    : slot.type === "audio"
      ? "border-orange-500/40 bg-orange-500/15 text-orange-100"
      : slot.source === "ai"
        ? "border-sky-500/40 bg-sky-500/15 text-sky-100"
        : "border-emerald-500/40 bg-emerald-500/15 text-emerald-100";

  return (
    <label
      title={
        fullWidth
          ? "Optional background music fitted to the full appended video length"
          : `${slot.label} (${formatSeconds(slot.startTime)} - ${formatSeconds(slot.startTime + slot.duration)})`
      }
      className={`group relative flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-2 py-2 text-center transition hover:brightness-110 ${palette}`}
      style={{
        gridColumn: `${slot.columnStart + 1} / span ${slot.columnSpan}`,
      }}
    >
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={isImporting}
        onChange={(event) => {
          onFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      {isImporting ? (
        <Loader2 size={16} className="animate-spin" />
      ) : mediaItem ? (
        <Check size={16} />
      ) : (
        <Upload size={16} />
      )}
      <span className="max-w-full truncate text-[10px] font-semibold">
        {mediaItem?.name ?? "Add media"}
      </span>
      <span className="max-w-full truncate text-[9px] opacity-80">
        {helperText ?? slot.shortLabel}
      </span>
    </label>
  );
};

export function applySalesPitchTemplate(
  project: Project,
  slotMediaIds: Record<string, string>,
  options: SalesPitchTemplateOptions = {},
): Project {
  const existingTemplateTracks = project.timeline.tracks.filter((track) =>
    track.clips.some(isTemplateClip),
  );
  const existingTemplateTrackIds = new Set(
    existingTemplateTracks.map((track) => track.id),
  );
  let videoTrack = project.timeline.tracks.find(
    (track) =>
      existingTemplateTrackIds.has(track.id) &&
      track.type === "video" &&
      track.name === VIDEO_TRACK_NAME,
  );
  let audioTrack = project.timeline.tracks.find(
    (track) =>
      existingTemplateTrackIds.has(track.id) &&
      track.type === "audio" &&
      track.name === AUDIO_TRACK_NAME,
  );
  let bgmTrack = project.timeline.tracks.find(
    (track) =>
      existingTemplateTrackIds.has(track.id) &&
      track.type === "audio" &&
      track.name === BGM_TRACK_NAME,
  );

  videoTrack ??= project.timeline.tracks.find(
    (track) => track.type === "video" && track.name === VIDEO_TRACK_NAME,
  );
  audioTrack ??= project.timeline.tracks.find(
    (track) => track.type === "audio" && track.name === AUDIO_TRACK_NAME,
  );
  bgmTrack ??= project.timeline.tracks.find(
    (track) => track.type === "audio" && track.name === BGM_TRACK_NAME,
  );

  const videoTrackId = videoTrack?.id ?? createId();
  const audioTrackId = audioTrack?.id ?? createId();
  const backgroundMusicMediaItem = options.backgroundMusicMediaId
    ? project.mediaLibrary.items.find(
        (item) => item.id === options.backgroundMusicMediaId,
      )
    : undefined;
  const bgmTrackId = backgroundMusicMediaItem
    ? (bgmTrack?.id ?? createId())
    : bgmTrack?.id;
  const mediaById = new Map(
    project.mediaLibrary.items.map((item) => [item.id, item]),
  );
  const {
    slots: resolvedSlots,
    duration: templateDuration,
    videoDuration,
  } = resolveTemplateSlots(project, slotMediaIds, options);
  const nextTemplateClips = resolvedSlots.map((slot) =>
    createTemplateClip(
      slot,
      mediaById.get(slotMediaIds[slot.id]),
      slot.type === "video" ? videoTrackId : audioTrackId,
    ),
  );
  if (backgroundMusicMediaItem && bgmTrackId) {
    nextTemplateClips.push(
      ...createBackgroundMusicClips(
        backgroundMusicMediaItem,
        bgmTrackId,
        videoDuration,
      ),
    );
  }
  const controlledTrackIds = new Set(
    [
      videoTrackId,
      audioTrackId,
      bgmTrackId,
      ...existingTemplateTrackIds,
    ].filter(Boolean) as string[],
  );

  const updatedTracks = project.timeline.tracks.map((track) => {
    const templateClips = nextTemplateClips.filter(
      (clip) => clip.trackId === track.id,
    );
    if (!controlledTrackIds.has(track.id) && templateClips.length === 0) {
      return track;
    }
    return {
      ...track,
      clips: [
        ...track.clips.filter((clip) => !isTemplateClip(clip)),
        ...templateClips,
      ].sort((left, right) => left.startTime - right.startTime),
      transitions: [],
    };
  });

  if (!videoTrack) {
    updatedTracks.unshift(
      createTemplateTrack(
        videoTrackId,
        "video",
        VIDEO_TRACK_NAME,
        nextTemplateClips,
      ),
    );
  }
  if (!audioTrack) {
    const videoIndex = updatedTracks.findIndex(
      (track) => track.id === videoTrackId,
    );
    updatedTracks.splice(
      videoIndex === -1 ? 1 : videoIndex + 1,
      0,
      createTemplateTrack(
        audioTrackId,
        "audio",
        AUDIO_TRACK_NAME,
        nextTemplateClips,
      ),
    );
  }
  if (backgroundMusicMediaItem && bgmTrackId && !bgmTrack) {
    const audioIndex = updatedTracks.findIndex(
      (track) => track.id === audioTrackId,
    );
    updatedTracks.splice(
      audioIndex === -1 ? updatedTracks.length : audioIndex + 1,
      0,
      createTemplateTrack(
        bgmTrackId,
        "audio",
        BGM_TRACK_NAME,
        nextTemplateClips,
      ),
    );
  }

  return {
    ...project,
    timeline: {
      ...project.timeline,
      tracks: updatedTracks,
      duration: Math.max(templateDuration, getTimelineDuration(updatedTracks)),
    },
    modifiedAt: Date.now(),
  };
}

function resolveTemplateSlots(
  project: Project,
  slotMediaIds: Record<string, string>,
  options: SalesPitchTemplateOptions = {},
): { slots: ResolvedTemplateSlot[]; duration: number; videoDuration: number } {
  const mediaById = new Map(
    project.mediaLibrary.items.map((item) => [item.id, item]),
  );
  const slotById = new Map(TEMPLATE_SLOTS.map((slot) => [slot.id, slot]));
  const resolvedById = new Map<string, ResolvedTemplateSlot>();

  let videoCursor = 0;
  for (const slotId of VIDEO_SLOT_SEQUENCE) {
    const slot = slotById.get(slotId);
    if (!slot) continue;
    const mediaItem = mediaById.get(slotMediaIds[slot.id]);
    const duration = getTemplateClipDuration(slot, mediaItem, {
      frameRate: project.settings.frameRate,
      trimAiVideoTailFrames:
        options.trimAiVideoTailFrames ?? DEFAULT_AI_VIDEO_TAIL_TRIM_FRAMES,
    });
    resolvedById.set(slot.id, {
      ...slot,
      resolvedStartTime: roundDuration(videoCursor),
      resolvedDuration: duration,
    });
    videoCursor = roundDuration(videoCursor + duration);
  }

  for (const slot of TEMPLATE_SLOTS.filter(
    (candidate) => candidate.type === "audio",
  )) {
    const mediaItem = mediaById.get(slotMediaIds[slot.id]);
    const anchorSlotId = AUDIO_SLOT_ANCHORS[slot.id];
    const anchorSlot = anchorSlotId
      ? resolvedById.get(anchorSlotId)
      : undefined;
    resolvedById.set(slot.id, {
      ...slot,
      resolvedStartTime: anchorSlot?.resolvedStartTime ?? slot.startTime,
      resolvedDuration: getTemplateClipDuration(slot, mediaItem),
    });
  }

  const slots = TEMPLATE_SLOTS.map((slot) => {
    const resolvedSlot = resolvedById.get(slot.id);
    if (!resolvedSlot) {
      throw new Error(
        `${slot.label} could not be placed on the template timeline.`,
      );
    }
    return resolvedSlot;
  });
  const duration = slots.reduce(
    (longestEnd, slot) =>
      Math.max(longestEnd, slot.resolvedStartTime + slot.resolvedDuration),
    videoCursor,
  );

  return {
    slots,
    duration: roundDuration(duration),
    videoDuration: roundDuration(videoCursor),
  };
}

function createTemplateTrack(
  trackId: string,
  type: Track["type"],
  name: string,
  templateClips: Clip[],
): Track {
  return {
    id: trackId,
    type,
    name,
    clips: templateClips.filter((clip) => clip.trackId === trackId),
    transitions: [],
    locked: false,
    hidden: false,
    muted: false,
    solo: false,
  };
}

function createTemplateClip(
  slot: ResolvedTemplateSlot,
  mediaItem: MediaItem | undefined,
  trackId: string,
): Clip {
  if (!mediaItem) {
    throw new Error(`${slot.label} is missing media.`);
  }
  return {
    id: createId(),
    mediaId: mediaItem.id,
    trackId,
    startTime: slot.resolvedStartTime,
    duration: slot.resolvedDuration,
    inPoint: 0,
    outPoint: slot.resolvedDuration,
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
    volume: slot.type === "video" && slot.source === "user" ? 0 : 1,
    keyframes: [],
    metadata: {
      stitchingTemplate: {
        templateId: TEMPLATE_ID,
        slotId: slot.id,
        label: slot.label,
        source: slot.source,
        plannedStartTime: slot.startTime,
        plannedDuration: slot.duration,
        appliedStartTime: slot.resolvedStartTime,
        appliedDuration: slot.resolvedDuration,
      },
    },
  };
}

function createBackgroundMusicClips(
  mediaItem: MediaItem,
  trackId: string,
  videoDuration: number,
): Clip[] {
  if (videoDuration <= 0) {
    return [];
  }

  const mediaDuration = getTemplateClipDuration(
    BACKGROUND_MUSIC_SLOT,
    mediaItem,
  );
  if (mediaDuration <= 0) {
    return [];
  }

  const clips: Clip[] = [];
  let startTime = 0;
  let loopIndex = 0;

  while (startTime < videoDuration - 0.001) {
    const remaining = roundDuration(videoDuration - startTime);
    const clipDuration = roundDuration(Math.min(mediaDuration, remaining));
    clips.push({
      id: createId(),
      mediaId: mediaItem.id,
      trackId,
      startTime: roundDuration(startTime),
      duration: clipDuration,
      inPoint: 0,
      outPoint: clipDuration,
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
      volume: 0.35,
      keyframes: [],
      metadata: {
        stitchingTemplate: {
          templateId: TEMPLATE_ID,
          slotId: BACKGROUND_MUSIC_SLOT_ID,
          label: BACKGROUND_MUSIC_SLOT.label,
          source: BACKGROUND_MUSIC_SLOT.source,
          appliedStartTime: roundDuration(startTime),
          appliedDuration: clipDuration,
          loopIndex,
          fittedToVideoDuration: videoDuration,
        },
      },
    });

    startTime = roundDuration(startTime + clipDuration);
    loopIndex += 1;
  }

  return clips;
}

async function applyTimelineLoudnessMatching(project: Project): Promise<void> {
  const clipsToProcess = getTimelineLoudnessTargets(project);
  if (clipsToProcess.length === 0) {
    toast.warning(
      "Loudness matching skipped",
      "No unmuted audio-bearing timeline clips were found.",
    );
    return;
  }

  const targetLufs = clampLoudnessTarget(DEFAULT_TEMPLATE_TARGET_LUFS);
  const bgmTargetLufs = clampLoudnessTarget(DEFAULT_TEMPLATE_BGM_TARGET_LUFS);
  const peakCeilingDbtp = clampPeakCeiling(DEFAULT_TEMPLATE_PEAK_CEILING_DBTP);
  const results = await Promise.allSettled(
    clipsToProcess.map(({ clip, mediaItem, role }) => {
      const clipTargetLufs =
        role === "background-music" ? bgmTargetLufs : targetLufs;
      return analyzeClipForLoudnessMatch({
        clip,
        mediaItem,
        targetLufs: clipTargetLufs,
        peakCeilingDbtp,
      }).then((result) => ({
        result,
        role,
        targetLufs: clipTargetLufs,
      }));
    }),
  );
  const matchedResults = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failedResults = results.filter(
    (result) => result.status === "rejected",
  );

  if (matchedResults.length > 0) {
    useProjectStore.getState().updateClipVolumes(
      matchedResults.map(({ result, role, targetLufs: clipTargetLufs }) => ({
        clipId: result.clipId,
        volume: result.gain.resultingVolume,
        loudnessMatch: {
          targetLufs: clipTargetLufs,
          peakCeilingDbtp,
          measuredIntegratedLufs: result.measurement.integratedLufs,
          measuredTruePeakDbtp: result.measurement.truePeakDbtp,
          appliedGainDb: result.gain.appliedGainDb,
          engine: result.measurement.engine,
          matchedAt: Date.now(),
          source:
            role === "background-music"
              ? "sales-pitch-template-background-music"
              : "sales-pitch-template",
        },
      })),
    );
  }

  if (failedResults.length === 0) {
    toast.success(
      "Loudness matching applied",
      `${matchedResults.length} timeline audio clip${matchedResults.length === 1 ? "" : "s"} matched. Narration targets ${targetLufs.toFixed(1)} LUFS; BGM targets ${bgmTargetLufs.toFixed(1)} LUFS.`,
    );
    return;
  }

  if (matchedResults.length > 0) {
    toast.warning(
      "Loudness matching partially applied",
      `${matchedResults.length} clip${matchedResults.length === 1 ? "" : "s"} matched; ${failedResults.length} clip${failedResults.length === 1 ? "" : "s"} skipped because audio could not be measured reliably.`,
    );
    return;
  }

  const firstReason =
    failedResults[0]?.status === "rejected" ? failedResults[0].reason : null;
  toast.error(
    "Loudness matching failed",
    firstReason instanceof Error
      ? firstReason.message
      : "Timeline audio could not be matched reliably.",
  );
}

function getTimelineLoudnessTargets(project: Project): Array<{
  clip: Clip;
  mediaItem: MediaItem;
  role: "foreground" | "background-music";
}> {
  const mediaById = new Map(
    project.mediaLibrary.items.map((item) => [item.id, item]),
  );
  return project.timeline.tracks
    .filter(
      (track) =>
        (track.type === "audio" || track.type === "video") &&
        !track.hidden &&
        !track.muted,
    )
    .flatMap((track) =>
      track.clips.flatMap(
        (
          clip,
        ): Array<{
          clip: Clip;
          mediaItem: MediaItem;
          role: "foreground" | "background-music";
        }> => {
          const mediaItem = mediaById.get(clip.mediaId);
          if (!mediaItem?.blob || clip.volume <= 0) {
            return [];
          }
          const isAudioBearingVideo =
            mediaItem.type === "video" &&
            ((mediaItem.metadata.channels ?? 0) > 0 ||
              (mediaItem.metadata.audioTrackCount ?? 0) > 0);
          if (mediaItem.type !== "audio" && !isAudioBearingVideo) {
            return [];
          }
          return [
            {
              clip,
              mediaItem,
              role: isTemplateBackgroundMusicClip(clip)
                ? "background-music"
                : "foreground",
            },
          ];
        },
      ),
    );
}

function getTemplateClipDuration(
  slot: TemplateSlot,
  mediaItem: MediaItem | undefined,
  options: { frameRate?: number; trimAiVideoTailFrames?: number } = {},
): number {
  const mediaDuration = mediaItem?.metadata.duration;
  const baseDuration =
    typeof mediaDuration === "number" &&
    Number.isFinite(mediaDuration) &&
    mediaDuration > 0
      ? mediaDuration
      : slot.duration;
  const trimFrames = Math.max(0, options.trimAiVideoTailFrames ?? 0);
  const frameRate =
    typeof options.frameRate === "number" &&
    Number.isFinite(options.frameRate) &&
    options.frameRate > 0
      ? options.frameRate
      : 24;
  const shouldTrimAiVideo =
    slot.type === "video" && slot.source === "ai" && trimFrames > 0;

  if (!shouldTrimAiVideo) {
    return roundDuration(baseDuration);
  }

  const trimDuration = trimFrames / frameRate;
  const minimumDuration = 1 / frameRate;
  return roundDuration(Math.max(minimumDuration, baseDuration - trimDuration));
}

function getTimelineDuration(tracks: Track[]): number {
  return roundDuration(
    tracks.reduce((longestEnd, track) => {
      const trackEnd = track.clips.reduce(
        (longestClipEnd, clip) =>
          Math.max(longestClipEnd, clip.startTime + clip.duration),
        0,
      );
      return Math.max(longestEnd, trackEnd);
    }, 0),
  );
}

function isTemplateClip(clip: Clip): boolean {
  const metadata = clip.metadata?.stitchingTemplate;
  return Boolean(
    metadata &&
    typeof metadata === "object" &&
    "templateId" in metadata &&
    metadata.templateId === TEMPLATE_ID,
  );
}

function isTemplateBackgroundMusicClip(clip: Clip): boolean {
  const metadata = clip.metadata?.stitchingTemplate;
  return Boolean(
    metadata &&
    typeof metadata === "object" &&
    "templateId" in metadata &&
    metadata.templateId === TEMPLATE_ID &&
    "slotId" in metadata &&
    metadata.slotId === BACKGROUND_MUSIC_SLOT_ID,
  );
}

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function formatSeconds(seconds: number): string {
  return `00:${Math.round(seconds).toString().padStart(2, "0")}`;
}

function roundDuration(seconds: number): number {
  return Number(seconds.toFixed(3));
}
