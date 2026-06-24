import { timelineDuration } from "./project.js";

export function buildRendererTimeline({ assets, timeline, audioTracks, settings = {} }) {
  const errors = [];
  const warnings = [];
  const assetMap = Object.fromEntries(assets.map((asset) => [asset.id, asset]));
  const normalizedAssets = {};

  for (const asset of assets) {
    normalizedAssets[asset.id] = {
      kind: asset.kind,
      objectUrl: asset.url,
      name: asset.name,
      duration: asset.duration,
      width: asset.width || null,
      height: asset.height || null,
    };
  }

  const videoTrackPayload = groupVideoTracks(timeline).map(([trackIndex, clips]) => ({
    id: `video_track_${trackIndex + 1}`,
    kind: "video",
    zIndex: trackIndex,
    clips: clips.map((item) => {
    const asset = assetMap[item.assetId];
    validateClip({ item, asset, errors, track: "video" });
    return {
      id: item.id,
      assetId: item.assetId,
      timelineStart: videoTimelineStart(timeline, item),
      trackIndex: Math.max(0, Math.floor(Number(item.trackIndex) || 0)),
      sourceStart: item.start,
      sourceDuration: roundTime(Math.max(0, item.end - item.start)),
      duration: clipTimelineDuration(item),
      speed: clipSpeed(item),
      muted: Boolean(item.muted),
      hidden: Boolean(item.hidden),
      audio: normalizeSourceAudio(item.audio),
      transform: item.transform || {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        flipX: false,
        flipY: false,
      },
    };
    }),
  }));

  const audioTrackPayload = Object.values(audioTracks).map((track, index) => ({
    id: track.id,
    kind: "audio",
    role: track.role,
    order: index,
    volume: Number(track.volume),
    clips: track.clips.map((clip) => {
      const asset = assetMap[clip.assetId];
      validateClip({ item: clip, asset, errors, track: track.id });
      return {
        id: clip.id,
        assetId: clip.assetId,
        timelineStart: clip.timelineStart,
        sourceStart: clip.sourceStart,
        duration: clip.duration,
        volume: Number(clip.volume ?? track.volume ?? 1),
      };
    }),
  }));

  if (timeline.length === 0) {
    warnings.push("Timeline has no video clips.");
  }

  return {
    ir: {
      schema: "renderer-timeline-ir",
      version: 1,
      canvas: {
        width: settings.width || 1280,
        height: settings.height || 720,
        fps: settings.fps || 30,
        background: settings.background || "#000000",
      },
      duration: roundTime(Math.max(timelineDuration(timeline), audioTimelineDuration(audioTracks))),
      assets: normalizedAssets,
      tracks: [
        ...videoTrackPayload,
        ...audioTrackPayload,
      ],
    },
    errors,
    warnings,
  };
}

export function getTrack(ir, kind, id = null) {
  return ir.tracks.find((track) => track.kind === kind && (!id || track.id === id)) || null;
}

function validateClip({ item, asset, errors, track }) {
  if (!asset) {
    errors.push(`Clip "${item.name || item.id}" on ${track} references a missing asset.`);
  }
  if (!(Number(item.duration ?? item.end - item.start) > 0)) {
    errors.push(`Clip "${item.name || item.id}" on ${track} must have positive duration.`);
  }
}

function audioTimelineDuration(audioTracks) {
  return Object.values(audioTracks).reduce((max, track) => {
    const trackMax = track.clips.reduce((clipMax, clip) => {
      return Math.max(clipMax, clip.timelineStart + clip.duration);
    }, 0);
    return Math.max(max, trackMax);
  }, 0);
}

function secondsBeforeItem(timeline, itemId) {
  const item = timeline.find((candidate) => candidate.id === itemId);
  return item ? videoTimelineStart(timeline, item) : 0;
}

function videoTimelineStart(timeline, item) {
  if (Number.isFinite(Number(item?.timelineStart))) return roundTime(Math.max(0, Number(item.timelineStart) || 0));
  let seconds = 0;
  for (const candidate of timeline) {
    if (candidate.id === item?.id) return roundTime(seconds);
    seconds += clipTimelineDuration(candidate);
  }
  return 0;
}

function clipSpeed(item) {
  return Math.min(Math.max(Number(item?.speed ?? 1) || 1, 0.25), 4);
}

function clipTimelineDuration(item) {
  return roundTime(Math.max(0, item.end - item.start) / clipSpeed(item));
}

function normalizeSourceAudio(audio = {}) {
  return {
    volume: roundTime(Math.min(Math.max(Number(audio.volume ?? 1), 0), 1)),
    fadeIn: roundTime(Math.max(0, Number(audio.fadeIn ?? 0) || 0)),
    fadeOut: roundTime(Math.max(0, Number(audio.fadeOut ?? 0) || 0)),
  };
}

function roundTime(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function groupVideoTracks(timeline) {
  const grouped = new Map();
  for (const item of timeline) {
    const trackIndex = Math.max(0, Math.floor(Number(item.trackIndex) || 0));
    if (!grouped.has(trackIndex)) grouped.set(trackIndex, []);
    grouped.get(trackIndex).push(item);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .map(([trackIndex, clips]) => [
      trackIndex,
      clips.sort((left, right) => videoTimelineStart(timeline, left) - videoTimelineStart(timeline, right)),
    ]);
}
