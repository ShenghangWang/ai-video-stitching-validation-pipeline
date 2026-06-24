export function buildPipelineJob({ assets, timeline, audioTracks = {}, settings = {} }) {
  const warnings = [];
  const audioClipCount = Object.values(audioTracks).reduce((total, track) => total + track.clips.length, 0);
  if (audioClipCount > 0) {
    warnings.push("Independent narration/music tracks are browser-only today and are not represented in the current Python pipeline job.");
  }

  const clips = timeline.map((item, index) => {
    const asset = assets.find((candidate) => candidate.id === item.assetId);
    const duration = Math.max(0, item.end - item.start);

    if (item.start > 0 || duration < (asset?.duration || duration)) {
      warnings.push(`Clip "${item.name}" contains trim data that the current Python pipeline may ignore.`);
    }

    if (item.muted) {
      warnings.push(`Clip "${item.name}" is muted in the browser editor, but the current Python pipeline does not preserve per-clip mute.`);
    }

    if (item.hidden) {
      warnings.push(`Clip "${item.name}" is hidden in the browser editor, but the current Python pipeline does not preserve hidden clips.`);
    }

    if (asset?.kind === "image") {
      warnings.push(`Clip "${item.name}" is a still image that is supported by the browser editor, but the current Python pipeline may expect video input.`);
    }

    if (item.transform && hasNonDefaultTransform(item.transform)) {
      warnings.push(`Clip "${item.name}" has transform data that the current Python pipeline does not apply.`);
    }

    return {
      clip_id: `clip_${index + 1}`,
      path: `input/browser_uploads/${asset?.file?.name || asset?.name || item.name}`,
      role: item.role || "manual_timeline_clip",
      order: index + 1,
      trim_start: item.start,
      trim_end: item.end,
      muted: item.muted,
      hidden: Boolean(item.hidden),
    };
  });

  return {
    job: {
      job_id: `manual_timeline_${Date.now()}`,
      mode: "timeline_assembly",
      clips,
      output: {
        video_path: "output/manual_timeline.mp4",
        metadata_path: "output/manual_timeline_metadata.json",
      },
      settings: {
        resolution: settings.resolution || "1280x720",
        fps: settings.fps || 30,
        transition: "cut",
      },
    },
    warnings: Array.from(new Set(warnings)),
  };
}

function hasNonDefaultTransform(transform) {
  return transform.x !== 0
    || transform.y !== 0
    || transform.scale !== 1
    || transform.rotation !== 0
    || transform.opacity !== 1;
}
