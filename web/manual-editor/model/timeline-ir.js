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

  const videoClips = timeline.map((item) => {
    const asset = assetMap[item.assetId];
    validateClip({ item, asset, errors, track: "video" });
    return {
      id: item.id,
      assetId: item.assetId,
      timelineStart: secondsBeforeItem(timeline, item.id),
      sourceStart: item.start,
      sourceDuration: roundTime(Math.max(0, item.end - item.start)),
      duration: clipTimelineDuration(item),
      speed: clipSpeed(item),
      muted: Boolean(item.muted),
      hidden: Boolean(item.hidden),
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
  });

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

  if (videoClips.length === 0) {
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
        {
          id: "video_track_1",
          kind: "video",
          zIndex: 0,
          clips: videoClips,
        },
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
  let seconds = 0;
  for (const item of timeline) {
    if (item.id === itemId) return roundTime(seconds);
    seconds += clipTimelineDuration(item);
  }
  return roundTime(seconds);
}

function clipSpeed(item) {
  return Math.min(Math.max(Number(item?.speed ?? 1) || 1, 0.25), 4);
}

function clipTimelineDuration(item) {
  return roundTime(Math.max(0, item.end - item.start) / clipSpeed(item));
}

function roundTime(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
