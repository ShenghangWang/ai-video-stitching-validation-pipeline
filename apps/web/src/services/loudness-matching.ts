import type { Clip, MediaItem } from "@openreel/core";
import {
  calculateLoudnessMatchGain,
  type LoudnessMatchGain,
} from "./loudness-matching-math";

export interface LoudnessMeasurement {
  integratedLufs: number;
  shortTermLufs: number;
  momentaryLufs: number;
  truePeakDbtp: number;
  loudnessRangeLu: number;
  engine: "loudness-worklet" | "approximate-fallback";
}

export interface LoudnessClipResult {
  clipId: string;
  clipName: string;
  measurement: LoudnessMeasurement;
  gain: LoudnessMatchGain;
}

type LoudnessWorkletConstructor = {
  new (
    context: BaseAudioContext,
    options?: AudioWorkletNodeOptions & {
      processorOptions?: { interval?: number; capacity?: number };
    },
  ): AudioWorkletNode;
  loadModule(context: BaseAudioContext): Promise<void>;
};

type BrowserAudioContextConstructor = typeof AudioContext;

const getAudioContextConstructor = (): BrowserAudioContextConstructor => {
  const maybeWindow = globalThis as typeof globalThis & {
    webkitAudioContext?: BrowserAudioContextConstructor;
  };
  const AudioContextCtor = maybeWindow.AudioContext ?? maybeWindow.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("This browser does not support AudioContext.");
  }
  return AudioContextCtor;
};

const getOfflineAudioContextConstructor = (): typeof OfflineAudioContext => {
  const maybeWindow = globalThis as typeof globalThis & {
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  };
  const OfflineAudioContextCtor =
    maybeWindow.OfflineAudioContext ?? maybeWindow.webkitOfflineAudioContext;
  if (!OfflineAudioContextCtor) {
    throw new Error("This browser does not support OfflineAudioContext.");
  }
  return OfflineAudioContextCtor;
};

async function decodeBlobDirectly(
  audioContext: BaseAudioContext,
  blob: Blob,
): Promise<AudioBuffer | null> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch {
    return null;
  }
}

async function extractAudioWithFallback(
  audioContext: BaseAudioContext,
  blob: Blob,
  audioTrackIndex: number,
): Promise<AudioBuffer | null> {
  try {
    const { getFFmpegFallback } = await import("@openreel/core/media");
    const ffmpeg = getFFmpegFallback();
    const wavBlob = await ffmpeg.extractAudioAsWav(blob, audioTrackIndex);
    return await decodeBlobDirectly(audioContext, wavBlob);
  } catch {
    return null;
  }
}

function extractClipSegment(
  audioContext: BaseAudioContext,
  buffer: AudioBuffer,
  clip: Clip,
): AudioBuffer {
  const startSeconds = Math.max(0, clip.inPoint ?? 0);
  const endSeconds = Math.min(
    buffer.duration,
    clip.outPoint ?? startSeconds + clip.duration,
    startSeconds + clip.duration,
  );
  const frameStart = Math.min(
    buffer.length,
    Math.max(0, Math.floor(startSeconds * buffer.sampleRate)),
  );
  const frameEnd = Math.min(
    buffer.length,
    Math.max(frameStart + 1, Math.ceil(endSeconds * buffer.sampleRate)),
  );
  const frameCount = Math.max(1, frameEnd - frameStart);
  const segment = audioContext.createBuffer(
    buffer.numberOfChannels,
    frameCount,
    buffer.sampleRate,
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const source = buffer.getChannelData(channel);
    const target = segment.getChannelData(channel);
    target.set(source.subarray(frameStart, frameEnd));
  }

  return segment;
}

export async function loadClipAudioBuffer(
  mediaItem: MediaItem,
  clip: Clip,
): Promise<AudioBuffer> {
  if (!mediaItem.blob) {
    throw new Error("This media item has no local audio data.");
  }

  const AudioContextCtor = getAudioContextConstructor();
  const audioContext = new AudioContextCtor();
  const audioTrackIndex = clip.audioTrackIndex ?? 0;

  try {
    let buffer: AudioBuffer | null = null;

    if (mediaItem.type === "audio" && audioTrackIndex === 0) {
      buffer = await decodeBlobDirectly(audioContext, mediaItem.blob);
    }

    buffer ??= await extractAudioWithFallback(
      audioContext,
      mediaItem.blob,
      audioTrackIndex,
    );

    if (!buffer && audioTrackIndex === 0) {
      buffer = await decodeBlobDirectly(audioContext, mediaItem.blob);
    }

    if (!buffer) {
      throw new Error("Could not decode this clip's audio.");
    }

    return extractClipSegment(audioContext, buffer, clip);
  } finally {
    if ("close" in audioContext) {
      void audioContext.close();
    }
  }
}

function getLatestFiniteMeasurement(snapshot: unknown): LoudnessMeasurement | null {
  const data = snapshot as {
    currentMeasurements?: Array<{
      momentaryLoudness?: number;
      shortTermLoudness?: number;
      integratedLoudness?: number;
      maximumTruePeakLevel?: number;
      loudnessRange?: number;
    }>;
  };
  const measurement = data.currentMeasurements?.find((candidate) =>
    Number.isFinite(candidate.integratedLoudness),
  );

  const integratedLoudness = measurement?.integratedLoudness;

  if (
    !measurement ||
    typeof integratedLoudness !== "number" ||
    !Number.isFinite(integratedLoudness)
  ) {
    return null;
  }

  return {
    integratedLufs: integratedLoudness,
    shortTermLufs: measurement?.shortTermLoudness ?? integratedLoudness,
    momentaryLufs: measurement?.momentaryLoudness ?? integratedLoudness,
    truePeakDbtp: measurement.maximumTruePeakLevel ?? Number.NEGATIVE_INFINITY,
    loudnessRangeLu: measurement.loudnessRange ?? 0,
    engine: "loudness-worklet",
  };
}

function measureApproximateLoudness(buffer: AudioBuffer): LoudnessMeasurement {
  let sumSquares = 0;
  let sampleCount = 0;
  let peak = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      const sample = data[index];
      sumSquares += sample * sample;
      sampleCount += 1;
      peak = Math.max(peak, Math.abs(sample));
    }
  }

  const rms = Math.sqrt(sumSquares / Math.max(1, sampleCount));
  const rmsDb = 20 * Math.log10(rms || 0.0001);
  const peakDb = 20 * Math.log10(peak || 0.0001);
  const approximateLufs = rmsDb - 0.691;

  return {
    integratedLufs: approximateLufs,
    shortTermLufs: approximateLufs,
    momentaryLufs: approximateLufs,
    truePeakDbtp: peakDb,
    loudnessRangeLu: 0,
    engine: "approximate-fallback",
  };
}

export async function measureClipLoudness(
  buffer: AudioBuffer,
): Promise<LoudnessMeasurement> {
  try {
    if (!("AudioWorkletNode" in globalThis)) {
      throw new Error("AudioWorkletNode is unavailable.");
    }

    const OfflineAudioContextCtor = getOfflineAudioContextConstructor();
    const context = new OfflineAudioContextCtor(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate,
    );
    const { LoudnessWorkletNode } = (await import("loudness-worklet")) as {
      LoudnessWorkletNode: LoudnessWorkletConstructor;
    };

    await LoudnessWorkletNode.loadModule(context);

    let latest: LoudnessMeasurement | null = null;
    const source = new AudioBufferSourceNode(context, { buffer });
    const worklet = new LoudnessWorkletNode(context, {
      processorOptions: {
        interval: 0.02,
        capacity: Math.max(1, buffer.duration),
      },
    });

    worklet.port.onmessage = (event) => {
      latest = getLatestFiniteMeasurement(event.data) ?? latest;
    };

    source.connect(worklet).connect(context.destination);
    source.start();
    await context.startRendering();
    worklet.port.close();
    worklet.disconnect();

    if (latest) {
      return latest;
    }
  } catch (error) {
    console.warn("[LoudnessMatching] Falling back to approximate loudness:", error);
  }

  return measureApproximateLoudness(buffer);
}

export async function analyzeClipForLoudnessMatch({
  clip,
  mediaItem,
  targetLufs,
  peakCeilingDbtp,
}: {
  clip: Clip;
  mediaItem: MediaItem;
  targetLufs: number;
  peakCeilingDbtp: number;
}): Promise<LoudnessClipResult> {
  const buffer = await loadClipAudioBuffer(mediaItem, clip);
  const measurement = await measureClipLoudness(buffer);

  if (measurement.integratedLufs <= -70) {
    throw new Error("This clip is silent or too quiet to match reliably.");
  }

  const gain = calculateLoudnessMatchGain({
    measuredIntegratedLufs: measurement.integratedLufs,
    measuredTruePeakDbtp: measurement.truePeakDbtp,
    targetLufs,
    peakCeilingDbtp,
  });

  return {
    clipId: clip.id,
    clipName: mediaItem.name,
    measurement,
    gain,
  };
}
