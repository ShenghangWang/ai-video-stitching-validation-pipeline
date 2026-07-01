import { describe, expect, it } from "vitest";
import {
  histogramSimilarity,
  perceptualHashSimilarity,
  solveClipOrder,
  transitionScore,
} from "./clip-ordering";

function solidImage(red: number, green: number, blue: number): ImageData {
  const width = 8;
  const height = 8;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = red;
    data[index + 1] = green;
    data[index + 2] = blue;
    data[index + 3] = 255;
  }
  return makeImageData(data, width, height);
}

function checkerImage(inverted = false): ImageData {
  const width = 8;
  const height = 8;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const bright = ((x + y) % 2 === 0) !== inverted;
      const value = bright ? 255 : 0;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return makeImageData(data, width, height);
}

function makeImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ImageData {
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

describe("clip ordering similarity", () => {
  it("scores identical boundary frames higher than different frames", () => {
    const red = solidImage(255, 0, 0);
    const blue = solidImage(0, 0, 255);

    expect(histogramSimilarity(red, red)).toBe(1);
    expect(histogramSimilarity(red, blue)).toBeLessThan(1);
    expect(transitionScore(red, red)).toBeGreaterThan(
      transitionScore(red, blue),
    );
  });

  it("compares perceptual hashes from frame structure", () => {
    const checker = checkerImage(false);
    const inverted = checkerImage(true);

    expect(perceptualHashSimilarity(checker, checker)).toBe(1);
    expect(perceptualHashSimilarity(checker, inverted)).toBeLessThan(0.5);
  });
});

describe("clip ordering solver", () => {
  it("recovers the strongest continuous order with brute force", () => {
    const result = solveClipOrder(
      ["c", "a", "b"],
      [
        { from: "a", to: "b", score: 0.9 },
        { from: "b", to: "c", score: 0.8 },
        { from: "a", to: "c", score: 0.2 },
        { from: "b", to: "a", score: 0.1 },
        { from: "c", to: "a", score: 0.1 },
        { from: "c", to: "b", score: 0.1 },
      ],
    );

    expect(result.method).toBe("bruteforce");
    expect(result.predictedOrder).toEqual(["a", "b", "c"]);
    expect(result.totalScore).toBeCloseTo(1.7);
    expect(result.confidenceScore).toBeGreaterThan(0.6);
  });

  it("uses greedy ordering above the brute-force limit", () => {
    const ids = Array.from({ length: 9 }, (_, index) => `clip-${index + 1}`);
    const scores = ids.flatMap((from, index) =>
      ids.flatMap((to, toIndex) =>
        from === to ? [] : [{ from, to, score: toIndex === index + 1 ? 1 : 0 }],
      ),
    );

    const result = solveClipOrder(ids, scores);

    expect(result.method).toBe("greedy");
    expect(result.predictedOrder).toHaveLength(9);
    expect(result.warnings).toContain(
      "Used greedy ordering because clip count exceeds brute-force limit.",
    );
  });
});
