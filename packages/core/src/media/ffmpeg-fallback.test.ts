import { describe, expect, it } from "vitest";
import { buildDynaudnormFilter } from "./ffmpeg-fallback";

describe("buildDynaudnormFilter", () => {
  it("uses the default volume-leveling settings", () => {
    expect(buildDynaudnormFilter()).toBe("dynaudnorm=f=250:g=15:p=0.90:m=6");
  });

  it("clamps unsafe values and keeps the gaussian size odd", () => {
    expect(
      buildDynaudnormFilter({
        frameLengthMs: 1,
        gaussianSize: 20,
        peakValue: 2,
        maxGain: 0,
      }),
    ).toBe("dynaudnorm=f=10:g=21:p=0.99:m=1");
  });
});
