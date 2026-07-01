import React, { useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, Waves } from "lucide-react";
import { toast } from "../../../stores/notification-store";
import { useProjectStore } from "../../../stores/project-store";
import {
  applyTimelineVolumeLeveling,
  getTimelineVolumeLevelingTargets,
  type VolumeLevelingSummary,
} from "../../../services/volume-leveling";

interface VolumeLevelingSectionProps {
  clipId: string;
}

type LevelingScope = "selected" | "timeline";

export const VolumeLevelingSection: React.FC<VolumeLevelingSectionProps> = ({
  clipId,
}) => {
  const project = useProjectStore((state) => state.project);
  const [scope, setScope] = useState<LevelingScope>("timeline");
  const [includeAlreadyLeveled, setIncludeAlreadyLeveled] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<VolumeLevelingSummary | null>(
    null,
  );

  const selectedTargets = useMemo(
    () =>
      getTimelineVolumeLevelingTargets(project, {
        clipIds: [clipId],
        includeAlreadyLeveled,
      }),
    [clipId, includeAlreadyLeveled, project],
  );

  const timelineTargets = useMemo(
    () =>
      getTimelineVolumeLevelingTargets(project, {
        includeAlreadyLeveled,
      }),
    [includeAlreadyLeveled, project],
  );

  const targetsToProcess =
    scope === "selected" ? selectedTargets : timelineTargets;

  const runVolumeLeveling = async () => {
    if (targetsToProcess.length === 0) {
      toast.warning(
        "No clips to level",
        scope === "selected"
          ? "Select an unmuted audio clip or a video clip with audio."
          : "The timeline has no unmuted audio/video clips that need volume leveling.",
      );
      setStatus("No eligible clips found");
      return;
    }

    setIsRunning(true);
    setLastSummary(null);
    setStatus(
      `Leveling ${targetsToProcess.length} clip${targetsToProcess.length === 1 ? "" : "s"}`,
    );

    try {
      const summary = await applyTimelineVolumeLeveling(
        useProjectStore.getState().project,
        {
          clipIds: scope === "selected" ? [clipId] : undefined,
          includeAlreadyLeveled,
        },
      );
      setLastSummary(summary);

      if (summary.processed > 0 && summary.failed === 0) {
        toast.success(
          "Volume leveling applied",
          `${summary.processed} clip${summary.processed === 1 ? "" : "s"} balanced.`,
        );
        setStatus("Balanced");
      } else if (summary.processed > 0) {
        toast.warning(
          "Volume leveling partially applied",
          `${summary.processed} clip${summary.processed === 1 ? "" : "s"} balanced; ${summary.failed} failed.`,
        );
        setStatus("Partially balanced");
      } else {
        const firstFailure = summary.failures[0]?.message;
        toast.warning(
          "Volume leveling skipped",
          firstFailure ?? "No clip audio could be leveled.",
        );
        setStatus("Skipped");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not run volume leveling.";
      toast.error("Volume leveling failed", message);
      setStatus(message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="space-y-3 rounded-lg border border-border bg-background-tertiary/40 p-3">
        <div className="flex items-start gap-2">
          <Waves size={16} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <div className="font-medium text-text-primary">Volume Leveling</div>
            <p className="mt-1 leading-relaxed text-text-muted">
              One-click balancing for sudden loud and quiet sections across the
              timeline before Loudness Matching.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void runVolumeLeveling()}
          disabled={isRunning}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2.5 font-semibold text-black hover:brightness-110 disabled:opacity-60"
        >
          {isRunning ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Waves size={15} />
          )}
          Volume Leveling
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
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope("selected")}
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
                onClick={() => setScope("timeline")}
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

            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background-secondary px-2 py-2 text-text-secondary">
              <input
                type="checkbox"
                checked={includeAlreadyLeveled}
                onChange={(event) =>
                  setIncludeAlreadyLeveled(event.currentTarget.checked)
                }
                disabled={isRunning}
                className="mt-0.5 h-3.5 w-3.5 accent-accent"
              />
              <span className="leading-relaxed">
                Re-level clips that already have processed audio
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <span className="text-text-muted">Selected</span>
              <span className="text-right text-text-primary">
                {selectedTargets.length}
              </span>
              <span className="text-text-muted">Timeline</span>
              <span className="text-right text-text-primary">
                {timelineTargets.length}
              </span>
              <span className="text-text-muted">Engine</span>
              <span className="text-right text-text-primary">
                FFmpeg dynaudnorm
              </span>
            </div>
          </div>
        )}

        {status && (
          <div className="flex items-center gap-2 text-text-muted">
            {isRunning ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Check size={13} />
            )}
            <span>{status}</span>
          </div>
        )}
      </div>

      {lastSummary && (
        <div className="rounded-lg border border-border bg-background-secondary p-3">
          <div className="mb-2 text-text-secondary">Last run</div>
          <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
            <span className="text-text-muted">Processed</span>
            <span className="text-right text-text-primary">
              {lastSummary.processed}
            </span>
            <span className="text-text-muted">Failed</span>
            <span className="text-right text-text-primary">
              {lastSummary.failed}
            </span>
          </div>
          {lastSummary.failures.length > 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-warning">
              {lastSummary.failures[0]?.clipName}:{" "}
              {lastSummary.failures[0]?.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
