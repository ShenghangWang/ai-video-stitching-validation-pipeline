import { getTrack } from "../model/timeline-ir.js";

export const MediaRecorderRenderer = {
  id: "media-recorder",
  label: "MediaRecorder WebM Renderer",
  async capabilities() {
    return {
      containers: ["webm"],
      videoCodecs: supportedVideoCodecs(),
      audioCodecs: ["opus"],
      supportsRealtimeOnly: true,
      supportsOfflineRender: false,
      supportsMultipleAudioTracks: true,
      supportsVideoTransforms: false,
      supportsTransitions: false,
    };
  },
  async render(ir, settings = {}) {
    return renderWithMediaRecorder(ir, settings);
  },
};

async function renderWithMediaRecorder(ir, settings) {
  if (!window.MediaRecorder) {
    throw new Error("MediaRecorder is not available in this browser.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = ir.canvas.width;
  canvas.height = ir.canvas.height;
  const context = canvas.getContext("2d");
  const fps = ir.canvas.fps;
  const video = document.createElement("video");
  video.playsInline = true;
  video.preload = "auto";

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = AudioContextClass ? new AudioContextClass() : null;
  const audioDestination = audioContext ? audioContext.createMediaStreamDestination() : null;
  const videoGain = audioContext ? audioContext.createGain() : null;
  if (audioContext && audioDestination && videoGain) {
    await audioContext.resume();
    const source = audioContext.createMediaElementSource(video);
    source.connect(videoGain);
    videoGain.connect(audioDestination);
  }

  const audioPlayers = audioContext && audioDestination
    ? buildAudioPlayers(ir, audioContext, audioDestination)
    : [];

  const canvasStream = canvas.captureStream(fps);
  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(audioDestination ? audioDestination.stream.getAudioTracks() : []),
  ]);
  const mimeType = pickMimeType();
  const chunks = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: settings.videoBitsPerSecond || 6_000_000,
  });
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  recorder.start(1000);
  try {
    let renderStartedAt = null;
    const startRenderClock = () => {
      if (renderStartedAt !== null) return;
      renderStartedAt = performance.now();
      startAudioPlayers(audioPlayers, renderStartedAt);
    };
    const videoTrack = getTrack(ir, "video");
    for (const clip of videoTrack?.clips || []) {
      await renderVideoClip({ clip, ir, video, context, videoGain, onFirstFrame: startRenderClock });
    }
    if (renderStartedAt === null) startRenderClock();
    await waitForRemainingAudio(ir, renderStartedAt);
  } finally {
    stopAudioPlayers(audioPlayers);
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    if (audioContext) await audioContext.close();
  }

  return {
    blob: new Blob(chunks, { type: mimeType || "video/webm" }),
    mimeType: mimeType || "video/webm",
    extension: "webm",
  };
}

async function renderVideoClip({ clip, ir, video, context, videoGain, onFirstFrame }) {
  const asset = ir.assets[clip.assetId];
  if (!asset) return;
  if (videoGain) videoGain.gain.value = clip.muted ? 0 : 1;
  video.src = asset.objectUrl;
  await waitForEvent(video, "loadedmetadata");
  await seekVideo(video, clip.sourceStart);
  await video.play();

  return new Promise((resolve) => {
    let firstFrameDrawn = false;
    const draw = () => {
      if (!firstFrameDrawn) {
        firstFrameDrawn = true;
        onFirstFrame();
      }
      drawVideoContain(context, video, ir.canvas.width, ir.canvas.height, ir.canvas.background);
      if (video.currentTime >= clip.sourceStart + clip.duration || video.ended) {
        video.pause();
        resolve();
        return;
      }
      requestAnimationFrame(draw);
    };
    draw();
  });
}

function buildAudioPlayers(ir, audioContext, audioDestination) {
  return ir.tracks
    .filter((track) => track.kind === "audio")
    .flatMap((track) => track.clips.map((clip) => {
      const asset = ir.assets[clip.assetId];
      const audio = document.createElement("audio");
      audio.preload = "auto";
      audio.src = asset.objectUrl;
      const gain = audioContext.createGain();
      gain.gain.value = Number(clip.volume ?? track.volume ?? 1);
      const source = audioContext.createMediaElementSource(audio);
      source.connect(gain);
      gain.connect(audioDestination);
      return { audio, clip, timer: null };
    }));
}

function startAudioPlayers(players, renderStartedAt) {
  for (const player of players) {
    const delayMs = Math.max(0, player.clip.timelineStart * 1000 - (performance.now() - renderStartedAt));
    player.timer = window.setTimeout(async () => {
      player.audio.currentTime = player.clip.sourceStart;
      try {
        await player.audio.play();
      } catch {
        // Export should continue even if one audio element cannot start.
      }
      window.setTimeout(() => player.audio.pause(), player.clip.duration * 1000);
    }, delayMs);
  }
}

function stopAudioPlayers(players) {
  for (const player of players) {
    window.clearTimeout(player.timer);
    player.audio.pause();
  }
}

function waitForRemainingAudio(ir, renderStartedAt) {
  const remainingMs = Math.max(0, ir.duration * 1000 - (performance.now() - renderStartedAt));
  return new Promise((resolve) => window.setTimeout(resolve, remainingMs));
}

function supportedVideoCodecs() {
  const options = [
    ["vp9", "video/webm;codecs=vp9,opus"],
    ["vp8", "video/webm;codecs=vp8,opus"],
  ];
  return options.filter(([, type]) => MediaRecorder.isTypeSupported(type)).map(([codec]) => codec);
}

function pickMimeType() {
  const options = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function waitForEvent(target, eventName) {
  if (eventName === "loadedmetadata" && target.readyState >= 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener("error", onError);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`${eventName} failed`));
    };
    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

function seekVideo(video, seconds) {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - seconds) < 0.01) {
      resolve();
      return;
    }
    const done = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", done);
      resolve();
    };
    const timeout = window.setTimeout(done, 1200);
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = seconds;
  });
}

function drawVideoContain(context, video, width, height, background) {
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  const sourceWidth = video.videoWidth || width;
  const sourceHeight = video.videoHeight || height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  context.drawImage(video, x, y, drawWidth, drawHeight);
}
