export const WebCodecsRenderer = {
  id: "webcodecs",
  label: "WebCodecs Renderer",
  async capabilities() {
    const hasWebCodecs = "VideoEncoder" in window && "VideoDecoder" in window;
    return {
      containers: hasWebCodecs ? ["mp4", "webm"] : [],
      videoCodecs: hasWebCodecs ? ["h264", "vp9", "av1"] : [],
      audioCodecs: hasWebCodecs && "AudioEncoder" in window ? ["aac", "opus"] : [],
      supportsRealtimeOnly: false,
      supportsOfflineRender: hasWebCodecs,
      supportsMultipleAudioTracks: false,
      supportsVideoTransforms: false,
      supportsTransitions: false,
      experimental: true,
    };
  },
  async render() {
    throw new Error("WebCodecsRenderer is scaffolded but not enabled. Use MediaRecorderRenderer for MVP exports.");
  },
};
