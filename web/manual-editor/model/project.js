export function buildEditorProject({ assets, timeline, audioTracks }) {
  const projectAssets = assets.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    duration: asset.duration,
    width: asset.width,
    height: asset.height,
    source: {
      type: "browser-file",
      name: asset.file?.name || asset.name,
    },
  }));

  const videoTracks = groupVideoTracks(timeline).map(([trackIndex, clips]) => ({
    id: `video_track_${trackIndex + 1}`,
    order: trackIndex,
    clips: clips.map((item) => ({
      id: item.id,
      assetId: item.assetId,
      name: item.name,
      role: item.role,
      timelineStart: videoTimelineStart(timeline, item),
      trackIndex: Math.max(0, Math.floor(Number(item.trackIndex) || 0)),
      sourceStart: item.start,
      sourceDuration: roundTime(Math.max(0, item.end - item.start)),
      duration: clipTimelineDuration(item),
      speed: clipSpeed(item),
      muted: item.muted,
      hidden: Boolean(item.hidden),
      transform: {
        x: Number(item.transform?.x ?? 0),
        y: Number(item.transform?.y ?? 0),
        scale: Number(item.transform?.scale ?? 1),
        rotation: Number(item.transform?.rotation ?? 0),
        opacity: Number(item.transform?.opacity ?? 1),
        flipX: Boolean(item.transform?.flipX),
        flipY: Boolean(item.transform?.flipY),
      },
    })),
  }));

  return {
    schema: "browser-video-editor-project",
    version: 1,
    created_at: new Date().toISOString(),
    assets: projectAssets,
    timeline: {
      duration: roundTime(Math.max(timelineDuration(timeline), audioTimelineDuration(audioTracks))),
      videoTracks,
      audioTracks: Object.values(audioTracks).map((track) => ({
        id: track.id,
        role: track.role,
        volume: Number(track.volume),
        clips: track.clips.map((clip) => ({
          id: clip.id,
          assetId: clip.assetId,
          name: clip.name,
          timelineStart: clip.timelineStart,
          sourceStart: clip.sourceStart,
          duration: clip.duration,
          volume: Number(clip.volume),
        })),
      })),
    },
  };
}

export function timelineDuration(timeline) {
  return timeline.reduce((max, item) => Math.max(max, videoTimelineStart(timeline, item) + clipTimelineDuration(item)), 0);
}

export function secondsBeforeItem(timeline, itemId) {
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

function roundTime(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function audioTimelineDuration(audioTracks) {
  if (!audioTracks) return 0;
  return Object.values(audioTracks).reduce((max, track) => {
    const trackMax = track.clips.reduce((clipMax, clip) => {
      return Math.max(clipMax, clip.timelineStart + clip.duration);
    }, 0);
    return Math.max(max, trackMax);
  }, 0);
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
