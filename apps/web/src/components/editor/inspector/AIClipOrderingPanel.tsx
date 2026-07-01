import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Clip, MediaItem, Project, Track } from "@openreel/core";
import { Check, Loader2, Shuffle, TriangleAlert } from "lucide-react";
import { toast } from "../../../stores/notification-store";
import { useProjectStore } from "../../../stores/project-store";
import {
  orderClipsByBoundarySimilarity,
  type ClipOrderingResult,
} from "../../../services/clip-ordering";

interface OrderableClip {
  clip: Clip;
  mediaItem: MediaItem;
  trackId: string;
  trackName: string;
}

export const AIClipOrderingPanel: React.FC = () => {
  const project = useProjectStore((state) => state.project);
  const allCheckboxRef = useRef<HTMLInputElement>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[] | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<ClipOrderingResult | null>(null);

  const { orderableClips, warnings } = useMemo(
    () => buildOrderableClips(project),
    [project],
  );
  const allClipIds = useMemo(
    () => orderableClips.map(({ clip }) => clip.id),
    [orderableClips],
  );
  const allClipIdKey = allClipIds.join("|");

  useEffect(() => {
    setSelectedClipIds((current) => {
      if (current === null) {
        return allClipIds;
      }
      const validIds = new Set(allClipIds);
      const next = current.filter((clipId) => validIds.has(clipId));
      if (next.length === current.length) {
        return current;
      }
      return next;
    });
  }, [allClipIdKey, allClipIds]);

  const selectedIds = selectedClipIds ?? allClipIds;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedClips = orderableClips.filter(({ clip }) =>
    selectedIdSet.has(clip.id),
  );
  const allSelected =
    orderableClips.length > 0 && selectedClips.length === orderableClips.length;
  const partiallySelected = selectedClips.length > 0 && !allSelected;

  useEffect(() => {
    if (allCheckboxRef.current) {
      allCheckboxRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);
  const selectionBlockingReason =
    selectedClips.length < 2
      ? "AI Clip Ordering needs at least two selected local video clips."
      : selectedClips.length > 8
        ? "AI Clip Ordering currently supports up to 8 clips."
        : null;

  const canOrder = selectedClips.length >= 2 && selectedClips.length <= 8;

  const applyOrderingToSelectedClips = (ordering: ClipOrderingResult) => {
    const orderedClipIds = new Set(ordering.predictedOrder);
    let applyError: Error | null = null;

    useProjectStore.setState((state) => {
      const currentEntries = findCurrentClipEntries(
        state.project,
        ordering.predictedOrder,
      );
      if (currentEntries.length !== ordering.predictedOrder.length) {
        applyError = new Error(
          "Some selected clips changed while AI Clip Ordering was running. Please run it again.",
        );
        return { project: state.project };
      }

      const destinationTrackId = currentEntries[0]?.track.id;
      if (!destinationTrackId) {
        applyError = new Error(
          "No destination video track found for clip ordering.",
        );
        return { project: state.project };
      }

      const clipById = new Map(
        currentEntries.map(({ clip }) => [clip.id, clip]),
      );
      const trackStart = Math.min(
        ...currentEntries.map(({ clip }) => clip.startTime),
      );
      let cursor = Number.isFinite(trackStart) ? trackStart : 0;

      const reorderedClips = ordering.predictedOrder.map((clipId, index) => {
        const clip = clipById.get(clipId);
        if (!clip) {
          applyError = new Error(
            `Missing clip ${clipId} while applying clip ordering.`,
          );
          return null;
        }
        const nextClip: Clip = {
          ...clip,
          trackId: destinationTrackId,
          startTime: cursor,
          metadata: {
            ...(clip.metadata ?? {}),
            aiClipOrdering: {
              predictedPosition: index,
              confidenceScore: ordering.confidenceScore,
              method: ordering.method,
              orderedAt: Date.now(),
            },
          },
        };
        cursor += clip.duration;
        return nextClip;
      });

      if (applyError) {
        return { project: state.project };
      }

      const nextTracks = state.project.timeline.tracks.map((track) => {
        const untouchedClips = track.clips.filter(
          (clip) => !orderedClipIds.has(clip.id),
        );
        if (track.id !== destinationTrackId) {
          return {
            ...track,
            clips: untouchedClips,
            transitions:
              track.transitions.length === 0 ? track.transitions : [],
          };
        }
        const orderedStart = trackStart;
        const orderedEnd = cursor;
        return {
          ...track,
          clips: [
            ...(reorderedClips as Clip[]),
            ...moveOverlappingClipsAfterSequence(
              untouchedClips,
              orderedStart,
              orderedEnd,
            ),
          ].sort((left, right) => left.startTime - right.startTime),
          transitions: [],
        };
      });
      const nextDuration = calculateTimelineDuration(nextTracks);

      return {
        project: {
          ...state.project,
          timeline: {
            ...state.project.timeline,
            tracks: nextTracks,
            duration: Math.max(
              state.project.timeline.duration ?? 0,
              nextDuration,
            ),
          },
          modifiedAt: Date.now(),
        },
      };
    });

    if (applyError) {
      throw applyError;
    }
  };

  const handleOrderClips = async () => {
    if (orderableClips.length === 0) {
      toast.warning(
        "No video clips found",
        "Add at least two local video clips first.",
      );
      return;
    }
    if (selectedClips.length < 2) {
      toast.warning(
        "Need more clips",
        "Select at least two local video clips.",
      );
      return;
    }
    if (selectedClips.length > 8) {
      toast.warning(
        "Too many clips",
        "AI Clip Ordering currently supports up to 8 clips.",
      );
      return;
    }

    const clipsToOrder = selectedClips;
    setIsOrdering(true);
    setResult(null);
    setStatus("Extracting boundary frames...");

    try {
      const ordering = await orderClipsByBoundarySimilarity(
        clipsToOrder.map(({ clip, mediaItem }) => ({
          id: clip.id,
          name: mediaItem.name,
          blob: mediaItem.blob as Blob,
          inPoint: clip.inPoint ?? 0,
          outPoint: clip.outPoint ?? (clip.inPoint ?? 0) + clip.duration,
          duration: clip.duration,
        })),
      );

      setStatus("Applying predicted order...");
      applyOrderingToSelectedClips(ordering);
      setResult(ordering);
      setStatus("Clip order applied");
      toast.success(
        "AI Clip Ordering applied",
        `${ordering.predictedOrder.length} selected clips reordered with ${(ordering.confidenceScore * 100).toFixed(0)}% confidence.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not order clips.";
      setStatus(message);
      toast.error("AI Clip Ordering failed", message);
    } finally {
      setIsOrdering(false);
    }
  };

  const toggleAllClips = () => {
    setSelectedClipIds(allSelected ? [] : allClipIds);
  };

  const toggleClip = (clipId: string) => {
    setSelectedClipIds((current) => {
      const currentIds = current ?? allClipIds;
      if (currentIds.includes(clipId)) {
        return currentIds.filter((id) => id !== clipId);
      }
      return [...currentIds, clipId];
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-background-tertiary p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/20">
            <Shuffle size={20} className="text-orange-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary">
              AI Clip Ordering
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
              Reconstructs continuous-source clip order by matching each clip's
              last frame to another clip's first frame. Supports up to 8 clips.
            </p>
          </div>
        </div>

        {orderableClips.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-medium text-text-secondary">
                Select clips to order
              </span>
              <span className="text-[10px] text-text-muted">
                {selectedClips.length}/{orderableClips.length} selected
              </span>
            </div>
            <div className="rounded-lg border border-border bg-background-secondary p-1.5">
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[11px] text-text-primary hover:bg-background-tertiary">
                <input
                  ref={allCheckboxRef}
                  type="checkbox"
                  checked={allSelected}
                  disabled={isOrdering}
                  onChange={toggleAllClips}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <span className="flex-1">All video clips</span>
                <span className="text-[10px] text-text-muted">
                  {partiallySelected
                    ? "Some selected"
                    : `${orderableClips.length} clips`}
                </span>
              </label>
              <div className="my-1 border-t border-border" />
              <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                {orderableClips.map(({ clip, mediaItem, trackName }) => (
                  <label
                    key={clip.id}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-[11px] text-text-primary hover:bg-background-tertiary"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIdSet.has(clip.id)}
                      disabled={isOrdering}
                      onChange={() => toggleClip(clip.id)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{mediaItem.name}</span>
                      <span className="block truncate text-[10px] text-text-muted">
                        {trackName} · {formatSeconds(clip.duration)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <p className="text-[10px] leading-relaxed text-text-muted">
              Choose any clip combination. Best for continuous-source
              reconstruction, up to 8 clips.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-background-secondary p-3 text-[11px] text-text-muted">
            Add at least two local video clips first.
          </div>
        )}

        {selectionBlockingReason && (
          <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-[11px] text-warning">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            <span>{selectionBlockingReason}</span>
          </div>
        )}

        {warnings.map((warning) => (
          <div
            key={warning}
            className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-[11px] text-warning"
          >
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            <span>{warning}</span>
          </div>
        ))}

        <button
          type="button"
          onClick={() => void handleOrderClips()}
          disabled={!canOrder || isOrdering}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-[11px] font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isOrdering ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Shuffle size={14} />
          )}
          Run AI Clip Ordering
        </button>

        {status && (
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            {isOrdering ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Check size={13} />
            )}
            <span>{status}</span>
          </div>
        )}
      </div>

      {result && (
        <div className="rounded-xl border border-border bg-background-secondary p-4 text-[11px]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="font-medium text-text-primary">
              Ordering result
            </span>
            <span className="font-mono text-primary">
              {(result.confidenceScore * 100).toFixed(0)}%
            </span>
          </div>
          <div className="space-y-1.5 font-mono text-text-secondary">
            {result.predictedOrder.map((clipId, index) => (
              <div key={clipId} className="flex items-center gap-2">
                <span className="text-text-muted">{index + 1}.</span>
                <span className="truncate">
                  {clipNameForId(project, clipId)}
                </span>
              </div>
            ))}
          </div>
          {result.warnings.length > 0 && (
            <div className="mt-3 space-y-1 rounded-lg border border-warning/30 bg-warning/10 p-2 text-warning">
              {result.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function buildOrderableClips(project: Project): {
  orderableClips: OrderableClip[];
  warnings: string[];
} {
  const mediaById = new Map(
    project.mediaLibrary.items.map((item) => [item.id, item]),
  );
  const videoTracks = project.timeline.tracks.filter(
    (track) => track.type === "video" && track.clips.length > 0,
  );
  const orderableClips: OrderableClip[] = [];
  const warnings: string[] = [];

  for (const track of videoTracks) {
    for (const clip of track.clips) {
      const mediaItem = mediaById.get(clip.mediaId);
      if (!mediaItem) {
        warnings.push(
          `Clip ${clip.id} has no linked media item and will be ignored.`,
        );
        continue;
      }
      if (mediaItem.type !== "video") {
        warnings.push(
          `${mediaItem.name} is not a video clip and will be ignored.`,
        );
        continue;
      }
      if (!mediaItem.blob) {
        warnings.push(
          `${mediaItem.name} is missing local video data and will be ignored.`,
        );
        continue;
      }
      orderableClips.push({
        clip,
        mediaItem,
        trackId: track.id,
        trackName: track.name,
      });
    }
  }

  return {
    orderableClips,
    warnings: uniqueWarnings(warnings),
  };
}

function uniqueWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)].slice(0, 3);
}

function findCurrentClipEntries(
  project: Project,
  clipIds: string[],
): Array<{ clip: Clip; track: Track }> {
  const entriesById = new Map<string, { clip: Clip; track: Track }>();
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      entriesById.set(clip.id, { clip, track });
    }
  }
  return clipIds.flatMap((clipId) => {
    const entry = entriesById.get(clipId);
    return entry ? [entry] : [];
  });
}

function moveOverlappingClipsAfterSequence(
  clips: Clip[],
  sequenceStart: number,
  sequenceEnd: number,
): Clip[] {
  let cursor = sequenceEnd;
  return [...clips]
    .sort((left, right) => left.startTime - right.startTime)
    .map((clip) => {
      const clipEnd = clip.startTime + clip.duration;
      if (clip.startTime < cursor && clipEnd > sequenceStart) {
        const movedClip = { ...clip, startTime: cursor };
        cursor += clip.duration;
        return movedClip;
      }
      return clip;
    });
}

function calculateTimelineDuration(tracks: Track[]): number {
  return tracks.reduce(
    (max, track) =>
      Math.max(
        max,
        ...track.clips.map((clip) => clip.startTime + clip.duration),
      ),
    0,
  );
}

function clipNameForId(project: Project, clipId: string): string {
  for (const track of project.timeline.tracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (!clip) continue;
    return (
      project.mediaLibrary.items.find((item) => item.id === clip.mediaId)
        ?.name ?? clipId
    );
  }
  return clipId;
}

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(2)}s`;
}
