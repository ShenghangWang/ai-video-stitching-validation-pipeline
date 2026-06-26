import React, { useEffect, useMemo, useState } from "react";
import type { Clip, MediaItem } from "@openreel/core";
import { Activity, Check, ChevronDown, Gauge, Loader2 } from "lucide-react";
import { toast } from "../../../stores/notification-store";
import { useProjectStore } from "../../../stores/project-store";
import {
  LOUDNESS_TARGET_PRESETS,
  calculateLoudnessMatchGain,
  clampLoudnessTarget,
  clampPeakCeiling,
} from "../../../services/loudness-matching-math";
import {
  analyzeClipForLoudnessMatch,
  type LoudnessClipResult,
} from "../../../services/loudness-matching";

interface LoudnessMatchingSectionProps {
  clipId: string;
}

type MatchScope = "selected" | "timeline";

interface LoudnessMatchingSettings {
  targetLufs: number;
  peakCeilingDbtp: number;
  scope: MatchScope;
}

const SETTINGS_STORAGE_KEY = "openreel.loudnessMatching.settings.v2";

const DEFAULT_SETTINGS: LoudnessMatchingSettings = {
  targetLufs: -16,
  peakCeilingDbtp: -1,
  scope: "timeline",
};

const formatDb = (value: number): string =>
  Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(1)} dB` : "-inf dB";

const formatLufs = (value: number): string =>
  Number.isFinite(value) ? `${value.toFixed(1)} LUFS` : "-inf LUFS";

const findClip = (clips: Clip[], clipId: string): Clip | null =>
  clips.find((clip) => clip.id === clipId) ?? null;

const loadSettings = (): LoudnessMatchingSettings => {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<LoudnessMatchingSettings>;
    return {
      targetLufs: clampLoudnessTarget(
        typeof parsed.targetLufs === "number"
          ? parsed.targetLufs
          : DEFAULT_SETTINGS.targetLufs,
      ),
      peakCeilingDbtp: clampPeakCeiling(
        typeof parsed.peakCeilingDbtp === "number"
          ? parsed.peakCeilingDbtp
          : DEFAULT_SETTINGS.peakCeilingDbtp,
      ),
      scope:
        parsed.scope === "selected" || parsed.scope === "timeline"
          ? parsed.scope
          : DEFAULT_SETTINGS.scope,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const saveSettings = (settings: LoudnessMatchingSettings) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Non-critical preference; loudness matching still works without persistence.
  }
};

export const LoudnessMatchingSection: React.FC<LoudnessMatchingSectionProps> = ({
  clipId,
}) => {
  const project = useProjectStore((state) => state.project);
  const updateClipVolumes = useProjectStore((state) => state.updateClipVolumes);
  const [settings, setSettings] = useState(loadSettings);
  const [isRunning, setIsRunning] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [results, setResults] = useState<LoudnessClipResult[]>([]);
  const { targetLufs, peakCeilingDbtp, scope } = settings;

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const clipsWithAudio = useMemo(() => {
    const mediaById = new Map(project.mediaLibrary.items.map((item) => [item.id, item]));
    return project.timeline.tracks
      .filter((track) => (track.type === "audio" || track.type === "video") && !track.hidden)
      .flatMap((track) =>
        track.clips.flatMap((clip): Array<{ clip: Clip; mediaItem: MediaItem }> => {
          const mediaItem = mediaById.get(clip.mediaId);
          if (!mediaItem?.blob || track.muted || clip.volume <= 0) return [];
          if (mediaItem.type !== "audio" && mediaItem.type !== "video") return [];
          return [{ clip, mediaItem }];
        }),
      );
  }, [project]);

  const selectedClip = useMemo(
    () => findClip(clipsWithAudio.map(({ clip }) => clip), clipId),
    [clipId, clipsWithAudio],
  );

  const selectedMediaItem = useMemo(
    () => clipsWithAudio.find(({ clip }) => clip.id === clipId)?.mediaItem ?? null,
    [clipId, clipsWithAudio],
  );

  const clipsToProcess = useMemo(() => {
    if (scope === "selected") {
      return selectedClip && selectedMediaItem
        ? [{ clip: selectedClip, mediaItem: selectedMediaItem }]
        : [];
    }
    return clipsWithAudio.map(({ clip, mediaItem }) => ({ clip, mediaItem }));
  }, [clipsWithAudio, scope, selectedClip, selectedMediaItem]);

  const runLoudnessMatch = async (apply: boolean) => {
    if (clipsToProcess.length === 0) {
      toast.warning(
        "No audio clips found",
        scope === "selected"
          ? "Select an audio clip or a video clip with audio."
          : "The timeline has no unmuted local audio/video clips.",
      );
      return;
    }

    setIsRunning(true);
    setResults([]);
    setStatus(`Analyzing 1 / ${clipsToProcess.length}`);

    try {
      const nextResults: LoudnessClipResult[] = [];

      for (const [index, { clip, mediaItem }] of clipsToProcess.entries()) {
        setStatus(`Analyzing ${index + 1} / ${clipsToProcess.length}: ${mediaItem.name}`);
        const result = await analyzeClipForLoudnessMatch({
          clip,
          mediaItem,
          targetLufs: clampLoudnessTarget(settings.targetLufs),
          peakCeilingDbtp: clampPeakCeiling(settings.peakCeilingDbtp),
        });
        nextResults.push(result);
      }

      setResults(nextResults);

      if (apply) {
        updateClipVolumes(
          nextResults.map((result) => ({
            clipId: result.clipId,
            volume: result.gain.resultingVolume,
            loudnessMatch: {
              targetLufs: clampLoudnessTarget(targetLufs),
              peakCeilingDbtp: clampPeakCeiling(peakCeilingDbtp),
              measuredIntegratedLufs: result.measurement.integratedLufs,
              measuredTruePeakDbtp: result.measurement.truePeakDbtp,
              appliedGainDb: result.gain.appliedGainDb,
              engine: result.measurement.engine,
              matchedAt: Date.now(),
            },
          })),
        );
        toast.success(
          "Loudness matched",
          `${nextResults.length} clip${nextResults.length === 1 ? "" : "s"} adjusted to ${formatLufs(
            clampLoudnessTarget(targetLufs),
          )}.`,
        );
      } else {
        toast.info("Loudness analyzed", `${nextResults.length} clip${nextResults.length === 1 ? "" : "s"} measured.`);
      }

      setStatus(apply ? "Matched" : "Analyzed");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not analyze loudness.";
      toast.error("Loudness matching failed", message);
      setStatus(message);
    } finally {
      setIsRunning(false);
    }
  };

  const targetPreview = results[0]
    ? calculateLoudnessMatchGain({
        measuredIntegratedLufs: results[0].measurement.integratedLufs,
        measuredTruePeakDbtp: results[0].measurement.truePeakDbtp,
        targetLufs,
        peakCeilingDbtp,
      })
    : null;

  const appliedGainRange = results.length
    ? results.reduce(
        (range, result) => ({
          min: Math.min(range.min, result.gain.appliedGainDb),
          max: Math.max(range.max, result.gain.appliedGainDb),
        }),
        { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
      )
    : null;

  const hasLimitedResults = results.some(
    (result) => result.gain.peakLimited || result.gain.volumeLimited,
  );
  const selectedPreset = LOUDNESS_TARGET_PRESETS.find(
    (preset) => preset.targetLufs === targetLufs,
  );
  const activePresetLabel = selectedPreset?.label ?? "Custom target";

  return (
    <div className="space-y-4 text-xs">
      <div className="rounded-lg border border-border bg-background-tertiary/40 p-3 space-y-3">
        <div className="flex items-start gap-2">
          <Gauge size={16} className="text-accent mt-0.5 shrink-0" />
          <div>
            <div className="text-text-primary font-medium">Loudness Matching</div>
            <p className="text-text-muted mt-1 leading-relaxed">
              One-click narration matching using {activePresetLabel} (
              {formatLufs(targetLufs)}), {peakCeilingDbtp.toFixed(1)} dBTP.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void runLoudnessMatch(true)}
          disabled={isRunning}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2.5 font-semibold text-black hover:brightness-110 disabled:opacity-60"
        >
          {isRunning ? <Loader2 size={15} className="animate-spin" /> : <Gauge size={15} />}
          Loudness Matching
        </button>

        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-md border border-border bg-background-secondary px-2 py-2 text-left font-medium text-text-secondary transition-colors hover:text-text-primary"
        >
          <span>Advanced Options</span>
          <ChevronDown
            size={14}
            className={`transition-transform ${advancedOpen ? "" : "-rotate-90"}`}
          />
        </button>

        {advancedOpen && (
          <div className="space-y-3 rounded-lg border border-border bg-background-secondary/60 p-3">
            <label className="block space-y-1.5">
              <span className="text-text-secondary">Target preset</span>
              <select
                value={targetLufs}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    targetLufs: Number(event.target.value),
                  }))
                }
                className="w-full rounded-md border border-border bg-background-secondary px-2 py-2 text-text-primary outline-none focus:border-accent"
                disabled={isRunning}
              >
                {!selectedPreset && (
                  <option value={targetLufs}>
                    Custom ({targetLufs.toFixed(1)} LUFS)
                  </option>
                )}
                {LOUDNESS_TARGET_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.targetLufs}>
                    {preset.label} ({preset.targetLufs} LUFS)
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="flex items-center justify-between text-text-secondary">
                <span>Custom target</span>
                <span className="font-mono text-text-primary">{formatLufs(targetLufs)}</span>
              </span>
              <input
                type="range"
                min={-30}
                max={-8}
                step={0.5}
                value={targetLufs}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    targetLufs: Number(event.target.value),
                  }))
                }
                disabled={isRunning}
                className="w-full accent-accent"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="flex items-center justify-between text-text-secondary">
                <span>True-peak ceiling</span>
                <span className="font-mono text-text-primary">{peakCeilingDbtp.toFixed(1)} dBTP</span>
              </span>
              <input
                type="range"
                min={-6}
                max={-0.1}
                step={0.1}
                value={peakCeilingDbtp}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    peakCeilingDbtp: Number(event.target.value),
                  }))
                }
                disabled={isRunning}
                className="w-full accent-accent"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setSettings((current) => ({ ...current, scope: "selected" }))
                }
                className={`rounded-md border px-2 py-2 font-medium transition-colors ${
                  scope === "selected"
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border bg-background-secondary text-text-secondary hover:text-text-primary"
                }`}
                disabled={isRunning}
              >
                Selected
              </button>
              <button
                type="button"
                onClick={() =>
                  setSettings((current) => ({ ...current, scope: "timeline" }))
                }
                className={`rounded-md border px-2 py-2 font-medium transition-colors ${
                  scope === "timeline"
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border bg-background-secondary text-text-secondary hover:text-text-primary"
                }`}
                disabled={isRunning}
              >
                Timeline
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSettings(DEFAULT_SETTINGS)}
                disabled={isRunning}
                className="rounded-md border border-border bg-background-secondary px-2 py-2 font-medium text-text-secondary hover:text-text-primary disabled:opacity-60"
              >
                Reset defaults
              </button>
              <button
                type="button"
                onClick={() => void runLoudnessMatch(false)}
                disabled={isRunning}
                className="rounded-md border border-border bg-background-secondary px-2 py-2 font-medium text-text-primary hover:bg-background-tertiary disabled:opacity-60"
              >
                Analyze only
              </button>
            </div>
          </div>
        )}

        {status && (
          <div className="flex items-center gap-2 text-text-muted">
            {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            <span>{status}</span>
          </div>
        )}
      </div>

      {targetPreview && (
        <div className="rounded-lg border border-border bg-background-secondary p-3">
          <div className="text-text-secondary mb-2">Last selected calculation</div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <span className="text-text-muted">Desired gain</span>
            <span className="text-text-primary text-right">{formatDb(targetPreview.desiredGainDb)}</span>
            <span className="text-text-muted">Gain</span>
            <span className="text-text-primary text-right">{formatDb(targetPreview.appliedGainDb)}</span>
            <span className="text-text-muted">New volume</span>
            <span className="text-text-primary text-right">{targetPreview.resultingVolume.toFixed(2)}x</span>
          </div>
          {(targetPreview.peakLimited || targetPreview.volumeLimited) && (
            <p className="mt-2 text-[11px] text-warning leading-relaxed">
              Applied gain is limited, so a louder target may not sound different
              until the true-peak ceiling or max volume allows it.
            </p>
          )}
        </div>
      )}

      {appliedGainRange && (
        <div className="rounded-lg border border-border bg-background-secondary p-3 text-[11px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-text-secondary">Applied gain range</span>
            <span className="font-mono text-text-primary">
              {formatDb(appliedGainRange.min)} to {formatDb(appliedGainRange.max)}
            </span>
          </div>
          {hasLimitedResults && (
            <p className="mt-2 text-warning leading-relaxed">
              Some clips hit the true-peak or max-volume limiter. In that case,
              moving the target louder may produce little or no audible change.
            </p>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result) => (
            <div
              key={result.clipId}
              className="rounded-lg border border-border bg-background-secondary p-3"
            >
              <div className="flex items-center gap-2 text-text-primary font-medium">
                <Activity size={13} className="text-accent shrink-0" />
                <span className="truncate">{result.clipName}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                <span className="text-text-muted">Measured</span>
                <span className="text-right text-text-primary">
                  {formatLufs(result.measurement.integratedLufs)}
                </span>
                <span className="text-text-muted">True peak</span>
                <span className="text-right text-text-primary">
                  {formatDb(result.measurement.truePeakDbtp).replace(" dB", " dBTP")}
                </span>
                <span className="text-text-muted">Applied gain</span>
                <span className="text-right text-text-primary">
                  {formatDb(result.gain.appliedGainDb)}
                </span>
                <span className="text-text-muted">Engine</span>
                <span className="text-right text-text-primary">
                  {result.measurement.engine === "loudness-worklet"
                    ? "BS.1770"
                    : "Fallback"}
                </span>
              </div>
              {(result.gain.peakLimited || result.gain.volumeLimited) && (
                <p className="mt-2 text-[11px] text-warning">
                  Gain was limited to avoid clipping or exceeding max clip volume.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
