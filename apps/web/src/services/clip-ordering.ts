export interface ClipOrderingInput {
  id: string;
  name: string;
  blob: Blob;
  inPoint: number;
  outPoint: number;
  duration: number;
}

export interface TransitionScore {
  from: string;
  to: string;
  score: number;
}

export interface ClipOrderingResult {
  predictedOrder: string[];
  transitionScores: TransitionScore[];
  totalScore: number;
  runnerUpScore: number | null;
  confidenceScore: number;
  method: "trivial" | "bruteforce" | "greedy";
  warnings: string[];
}

interface BoundarySignature {
  clipId: string;
  firstFrame: ImageData;
  lastFrame: ImageData;
}

const FRAME_SIZE = 64;
const HISTOGRAM_BINS = 16;
const HASH_SIZE = 8;
const FRAME_EDGE_OFFSET_SECONDS = 0.05;

export async function orderClipsByBoundarySimilarity(
  clips: ClipOrderingInput[],
): Promise<ClipOrderingResult> {
  if (clips.length <= 1) {
    return {
      predictedOrder: clips.map((clip) => clip.id).sort(),
      transitionScores: [],
      totalScore: 0,
      runnerUpScore: null,
      confidenceScore: 1,
      method: "trivial",
      warnings: [],
    };
  }

  const signatures = await Promise.all(clips.map(extractBoundarySignature));
  const transitionScores = buildTransitionScores(signatures);
  return solveClipOrder(
    clips.map((clip) => clip.id),
    transitionScores,
  );
}

export function buildTransitionScores(
  signatures: BoundarySignature[],
): TransitionScore[] {
  const scores: TransitionScore[] = [];
  for (const from of signatures) {
    for (const to of signatures) {
      if (from.clipId === to.clipId) continue;
      scores.push({
        from: from.clipId,
        to: to.clipId,
        score: transitionScore(from.lastFrame, to.firstFrame),
      });
    }
  }
  return scores;
}

export function transitionScore(
  lastFrame: ImageData,
  firstFrame: ImageData,
): number {
  const histogram = histogramSimilarity(lastFrame, firstFrame);
  const phash = perceptualHashSimilarity(lastFrame, firstFrame);
  return roundScore(0.6 * histogram + 0.4 * phash);
}

export function histogramSimilarity(
  imageA: ImageData,
  imageB: ImageData,
  bins = HISTOGRAM_BINS,
): number {
  assertComparableImages(imageA, imageB);
  const channelScores: number[] = [];

  for (let channel = 0; channel < 3; channel += 1) {
    const histA = new Array<number>(bins).fill(0);
    const histB = new Array<number>(bins).fill(0);

    for (let index = channel; index < imageA.data.length; index += 4) {
      histA[
        Math.min(bins - 1, Math.floor((imageA.data[index] / 256) * bins))
      ] += 1;
      histB[
        Math.min(bins - 1, Math.floor((imageB.data[index] / 256) * bins))
      ] += 1;
    }

    const totalA = histA.reduce((sum, value) => sum + value, 0);
    const totalB = histB.reduce((sum, value) => sum + value, 0);
    if (!totalA || !totalB) {
      channelScores.push(0);
      continue;
    }

    let intersection = 0;
    for (let bin = 0; bin < bins; bin += 1) {
      intersection += Math.min(histA[bin] / totalA, histB[bin] / totalB);
    }
    channelScores.push(intersection);
  }

  return roundScore(
    channelScores.reduce((sum, value) => sum + value, 0) / channelScores.length,
  );
}

export function perceptualHashSimilarity(
  imageA: ImageData,
  imageB: ImageData,
  hashSize = HASH_SIZE,
): number {
  const hashA = averageHash(imageA, hashSize);
  const hashB = averageHash(imageB, hashSize);
  let distance = 0;
  for (let index = 0; index < hashA.length; index += 1) {
    if (hashA[index] !== hashB[index]) distance += 1;
  }
  return roundScore(1 - distance / Math.max(1, hashA.length));
}

export function averageHash(image: ImageData, hashSize = HASH_SIZE): boolean[] {
  const values: number[] = [];
  const blockWidth = image.width / hashSize;
  const blockHeight = image.height / hashSize;

  for (let y = 0; y < hashSize; y += 1) {
    for (let x = 0; x < hashSize; x += 1) {
      const startX = Math.floor(x * blockWidth);
      const endX = Math.max(startX + 1, Math.floor((x + 1) * blockWidth));
      const startY = Math.floor(y * blockHeight);
      const endY = Math.max(startY + 1, Math.floor((y + 1) * blockHeight));
      let total = 0;
      let count = 0;

      for (let py = startY; py < endY; py += 1) {
        for (let px = startX; px < endX; px += 1) {
          const offset = (py * image.width + px) * 4;
          total +=
            0.299 * image.data[offset] +
            0.587 * image.data[offset + 1] +
            0.114 * image.data[offset + 2];
          count += 1;
        }
      }
      values.push(total / Math.max(1, count));
    }
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.map((value) => value >= average);
}

export function solveClipOrder(
  clipIds: string[],
  transitionScores: TransitionScore[],
): ClipOrderingResult {
  const sortedClipIds = [...clipIds].sort();
  const scoreMap = new Map<string, number>(
    transitionScores
      .filter((score) => score.from !== score.to)
      .map((score) => [`${score.from}\u0000${score.to}`, score.score]),
  );

  if (sortedClipIds.length <= 1) {
    return {
      predictedOrder: sortedClipIds,
      transitionScores,
      totalScore: 0,
      runnerUpScore: null,
      confidenceScore: 1,
      method: "trivial",
      warnings: [],
    };
  }

  if (sortedClipIds.length <= 8) {
    return solveBruteforce(sortedClipIds, scoreMap, transitionScores);
  }
  return solveGreedy(sortedClipIds, scoreMap, transitionScores);
}

async function extractBoundarySignature(
  clip: ClipOrderingInput,
): Promise<BoundarySignature> {
  const video = document.createElement("video");
  const url = URL.createObjectURL(clip.blob);
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  try {
    video.src = url;
    await waitForVideoMetadata(video);
    const sourceDuration =
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : clip.inPoint + clip.duration;
    const clipStart = clamp(
      clip.inPoint + FRAME_EDGE_OFFSET_SECONDS,
      0,
      Math.max(0, sourceDuration - 0.01),
    );
    const rawClipEnd = Number.isFinite(clip.outPoint)
      ? clip.outPoint
      : clip.inPoint + clip.duration;
    const clipEnd = clamp(
      rawClipEnd - FRAME_EDGE_OFFSET_SECONDS,
      clipStart,
      Math.max(clipStart, sourceDuration - 0.01),
    );

    return {
      clipId: clip.id,
      firstFrame: await captureVideoFrame(video, clipStart),
      lastFrame: await captureVideoFrame(video, clipEnd),
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

function solveBruteforce(
  clipIds: string[],
  scoreMap: Map<string, number>,
  transitionScores: TransitionScore[],
): ClipOrderingResult {
  let bestOrder: string[] | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let runnerUpScore = Number.NEGATIVE_INFINITY;
  let tieCount = 0;

  for (const order of permutations(clipIds)) {
    const score = pathScore(order, scoreMap);
    if (score > bestScore) {
      runnerUpScore = bestScore;
      bestScore = score;
      bestOrder = order;
      tieCount = 0;
    } else if (score === bestScore) {
      tieCount += 1;
    } else if (score > runnerUpScore) {
      runnerUpScore = score;
    }
  }

  const finalOrder = bestOrder ?? clipIds;
  const finalRunnerUp =
    runnerUpScore === Number.NEGATIVE_INFINITY ? null : runnerUpScore;
  const confidenceScore = confidence(bestScore, finalRunnerUp, clipIds.length);
  return {
    predictedOrder: finalOrder,
    transitionScores,
    totalScore: roundScore(bestScore),
    runnerUpScore: finalRunnerUp === null ? null : roundScore(finalRunnerUp),
    confidenceScore,
    method: "bruteforce",
    warnings: orderingWarnings(
      confidenceScore,
      bestScore,
      finalRunnerUp,
      tieCount,
    ),
  };
}

function solveGreedy(
  clipIds: string[],
  scoreMap: Map<string, number>,
  transitionScores: TransitionScore[],
): ClipOrderingResult {
  const unused = new Set(clipIds);
  const start = [...clipIds].sort((left, right) => {
    const incomingDelta =
      maxIncoming(left, clipIds, scoreMap) -
      maxIncoming(right, clipIds, scoreMap);
    return incomingDelta || left.localeCompare(right);
  })[0];
  const order = [start];
  unused.delete(start);

  while (unused.size > 0) {
    const current = order[order.length - 1];
    const next = [...unused].sort((left, right) => {
      const scoreDelta =
        score(scoreMap, current, right) - score(scoreMap, current, left);
      return scoreDelta || left.localeCompare(right);
    })[0];
    order.push(next);
    unused.delete(next);
  }

  const totalScore = pathScore(order, scoreMap);
  const confidenceScore = confidence(totalScore, null, clipIds.length);
  return {
    predictedOrder: order,
    transitionScores,
    totalScore: roundScore(totalScore),
    runnerUpScore: null,
    confidenceScore,
    method: "greedy",
    warnings: [
      "Used greedy ordering because clip count exceeds brute-force limit.",
      ...orderingWarnings(confidenceScore, totalScore, null, 0),
    ],
  };
}

function pathScore(order: string[], scoreMap: Map<string, number>): number {
  return order.reduce((total, clipId, index) => {
    if (index === 0) return total;
    return total + score(scoreMap, order[index - 1], clipId);
  }, 0);
}

function score(
  scoreMap: Map<string, number>,
  from: string,
  to: string,
): number {
  return scoreMap.get(`${from}\u0000${to}`) ?? 0;
}

function maxIncoming(
  clipId: string,
  clipIds: string[],
  scoreMap: Map<string, number>,
): number {
  return Math.max(
    0,
    ...clipIds
      .filter((other) => other !== clipId)
      .map((other) => score(scoreMap, other, clipId)),
  );
}

function confidence(
  totalScore: number,
  runnerUpScore: number | null,
  clipCount: number,
): number {
  const edgeCount = Math.max(clipCount - 1, 1);
  const averageScore = clamp(totalScore / edgeCount, 0, 1);
  const margin =
    runnerUpScore === null
      ? 0
      : clamp((totalScore - runnerUpScore) / edgeCount, 0, 1);
  return roundScore(clamp(0.75 * averageScore + 0.25 * margin, 0, 1));
}

function orderingWarnings(
  confidenceScore: number,
  bestScore: number,
  runnerUpScore: number | null,
  tieCount: number,
): string[] {
  const warnings: string[] = [];
  if (tieCount > 0) {
    warnings.push("Multiple orders had the same best transition score.");
  }
  if (runnerUpScore !== null && bestScore - runnerUpScore < 0.05) {
    warnings.push("Winning order has weak separation from runner-up.");
  }
  if (confidenceScore < 0.6) {
    warnings.push("Low confidence ordering result.");
  }
  return warnings;
}

function* permutations(values: string[]): Generator<string[]> {
  if (values.length <= 1) {
    yield values;
    return;
  }
  for (let index = 0; index < values.length; index += 1) {
    const head = values[index];
    const tail = [...values.slice(0, index), ...values.slice(index + 1)];
    for (const permutation of permutations(tail)) {
      yield [head, ...permutation];
    }
  }
}

function waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA)
    return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not load video metadata for clip ordering."));
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function captureVideoFrame(
  video: HTMLVideoElement,
  timeSeconds: number,
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = FRAME_SIZE;
    canvas.height = FRAME_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      reject(new Error("Canvas 2D is unavailable for clip ordering."));
      return;
    }

    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    const onSeeked = () => {
      try {
        context.drawImage(video, 0, 0, FRAME_SIZE, FRAME_SIZE);
        const frame = context.getImageData(0, 0, FRAME_SIZE, FRAME_SIZE);
        cleanup();
        resolve(frame);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error("Could not seek video for clip ordering."));
    };
    const captureCurrentFrame = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        queueMicrotask(onSeeked);
        return true;
      }
      return false;
    };

    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    if (
      Math.abs(video.currentTime - timeSeconds) < 0.001 &&
      captureCurrentFrame()
    ) {
      return;
    }
    video.currentTime = timeSeconds;
  });
}

function assertComparableImages(imageA: ImageData, imageB: ImageData): void {
  if (
    imageA.width !== imageB.width ||
    imageA.height !== imageB.height ||
    imageA.data.length !== imageB.data.length
  ) {
    throw new Error("Boundary frames must have the same dimensions.");
  }
}

function roundScore(value: number): number {
  return Number(value.toFixed(6));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
