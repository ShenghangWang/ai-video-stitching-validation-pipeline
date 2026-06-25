import { describe, expect, it } from "vitest";
import {
  calculateLoudnessMatchGain,
  dbToLinear,
  linearToDb,
} from "./loudness-matching-math";

describe("loudness matching math", () => {
  it("raises quiet narration to the target LUFS", () => {
    const gain = calculateLoudnessMatchGain({
      measuredIntegratedLufs: -24,
      measuredTruePeakDbtp: -12,
      targetLufs: -16,
      peakCeilingDbtp: -1,
    });

    expect(gain.appliedGainDb).toBeCloseTo(8, 3);
    expect(gain.resultingVolume).toBeCloseTo(dbToLinear(8), 3);
    expect(gain.estimatedIntegratedLufs).toBeCloseTo(-16, 3);
    expect(gain.peakLimited).toBe(false);
  });

  it("limits gain when the true peak ceiling would be exceeded", () => {
    const gain = calculateLoudnessMatchGain({
      measuredIntegratedLufs: -24,
      measuredTruePeakDbtp: -4,
      targetLufs: -16,
      peakCeilingDbtp: -1,
    });

    expect(gain.desiredGainDb).toBeCloseTo(8, 3);
    expect(gain.appliedGainDb).toBeCloseTo(3, 3);
    expect(gain.estimatedTruePeakDbtp).toBeCloseTo(-1, 3);
    expect(gain.peakLimited).toBe(true);
  });

  it("caps the result at the editor max clip volume", () => {
    const gain = calculateLoudnessMatchGain({
      measuredIntegratedLufs: -35,
      measuredTruePeakDbtp: -40,
      targetLufs: -16,
      peakCeilingDbtp: -1,
      maxVolume: 4,
    });

    expect(gain.resultingVolume).toBe(4);
    expect(gain.appliedGainDb).toBeCloseTo(linearToDb(4), 3);
    expect(gain.volumeLimited).toBe(true);
  });

  it("lowers clips that are already louder than the target", () => {
    const gain = calculateLoudnessMatchGain({
      measuredIntegratedLufs: -10,
      measuredTruePeakDbtp: -2,
      targetLufs: -16,
      peakCeilingDbtp: -1,
    });

    expect(gain.appliedGainDb).toBeCloseTo(-6, 3);
    expect(gain.resultingVolume).toBeCloseTo(dbToLinear(-6), 3);
    expect(gain.estimatedIntegratedLufs).toBeCloseTo(-16, 3);
  });
});
