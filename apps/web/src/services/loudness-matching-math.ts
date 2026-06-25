export const LOUDNESS_TARGET_PRESETS = [
  {
    id: "speech-online",
    label: "Speech / narration",
    targetLufs: -16,
    description: "Good default for generated narrator clips.",
  },
  {
    id: "web-video",
    label: "Web video",
    targetLufs: -14,
    description: "Common online video target.",
  },
  {
    id: "broadcast",
    label: "Broadcast",
    targetLufs: -23,
    description: "Conservative broadcast-style target.",
  },
] as const;

export type LoudnessTargetPresetId = (typeof LOUDNESS_TARGET_PRESETS)[number]["id"];

export interface LoudnessMatchInput {
  measuredIntegratedLufs: number;
  measuredTruePeakDbtp: number;
  targetLufs: number;
  peakCeilingDbtp: number;
  maxVolume?: number;
}

export interface LoudnessMatchGain {
  desiredGainDb: number;
  appliedGainDb: number;
  resultingVolume: number;
  estimatedIntegratedLufs: number;
  estimatedTruePeakDbtp: number;
  peakLimited: boolean;
  volumeLimited: boolean;
}

export function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

export function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

export function clampLoudnessTarget(targetLufs: number): number {
  return Math.max(-30, Math.min(-8, targetLufs));
}

export function clampPeakCeiling(peakCeilingDbtp: number): number {
  return Math.max(-6, Math.min(-0.1, peakCeilingDbtp));
}

export function calculateLoudnessMatchGain({
  measuredIntegratedLufs,
  measuredTruePeakDbtp,
  targetLufs,
  peakCeilingDbtp,
  maxVolume = 4,
}: LoudnessMatchInput): LoudnessMatchGain {
  if (!Number.isFinite(measuredIntegratedLufs)) {
    throw new Error("Integrated loudness is not measurable.");
  }

  const safeTarget = clampLoudnessTarget(targetLufs);
  const safePeakCeiling = clampPeakCeiling(peakCeilingDbtp);
  const desiredGainDb = safeTarget - measuredIntegratedLufs;
  const peakLimitGainDb = Number.isFinite(measuredTruePeakDbtp)
    ? safePeakCeiling - measuredTruePeakDbtp
    : Number.POSITIVE_INFINITY;
  const peakSafeGainDb = Math.min(desiredGainDb, peakLimitGainDb);
  const maxVolumeGainDb = linearToDb(Math.max(0.01, maxVolume));
  const appliedGainDb = Math.min(peakSafeGainDb, maxVolumeGainDb);
  const resultingVolume = Math.max(0, Math.min(maxVolume, dbToLinear(appliedGainDb)));
  const effectiveGainDb = linearToDb(resultingVolume);

  return {
    desiredGainDb,
    appliedGainDb: effectiveGainDb,
    resultingVolume,
    estimatedIntegratedLufs: measuredIntegratedLufs + effectiveGainDb,
    estimatedTruePeakDbtp: Number.isFinite(measuredTruePeakDbtp)
      ? measuredTruePeakDbtp + effectiveGainDb
      : measuredTruePeakDbtp,
    peakLimited: peakLimitGainDb < desiredGainDb,
    volumeLimited: maxVolumeGainDb < peakSafeGainDb,
  };
}
