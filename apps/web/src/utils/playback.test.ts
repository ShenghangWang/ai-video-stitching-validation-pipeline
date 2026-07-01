import { describe, expect, it } from "vitest";

import { isAtTimelineEnd } from "./playback";

describe("playback utilities", () => {
  it("detects exact timeline end", () => {
    expect(isAtTimelineEnd(15, 15)).toBe(true);
  });

  it("tolerates tiny floating-point drift near timeline end", () => {
    expect(isAtTimelineEnd(14.99, 15, 0.02)).toBe(true);
  });

  it("does not restart while meaningfully before timeline end", () => {
    expect(isAtTimelineEnd(14.9, 15, 0.02)).toBe(false);
  });

  it("does not treat an empty timeline as ended playback", () => {
    expect(isAtTimelineEnd(0, 0)).toBe(false);
  });
});
