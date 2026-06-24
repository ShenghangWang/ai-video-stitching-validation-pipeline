import { buildPipelineJob } from "./adapters/pipeline-job-adapter.js";
import { buildEditorProject } from "./model/project.js";
import { buildRendererTimeline } from "./model/timeline-ir.js";
import { MediaRecorderRenderer } from "./renderers/media-recorder-renderer.js";

const TRACK_PIXEL_WIDTH = 1900;
const PROJECT_STORE = "manual-editor-project";
const DEFAULT_TRANSFORM = Object.freeze({
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
});

const state = {
  assets: [],
  timeline: [],
  videoTrack: { id: "video_track_1", locked: false, hidden: false, muted: false, solo: false },
  audioTracks: {
    narration: { id: "narration_track", role: "narration", volume: 1, clips: [], locked: false, muted: false, solo: false },
    music: { id: "music_track", role: "music", volume: 0.35, clips: [], locked: false, muted: false, solo: false },
  },
  selectedItemId: null,
  activeItemId: null,
  cursorSeconds: 0,
  playToken: 0,
  isPlaying: false,
  audioPreviewTimers: [],
  audioPreviewElements: [],
  mediaFilter: "all",
  mediaSearch: "",
  history: [],
  future: [],
  restoringHistory: false,
  resizeDrag: null,
  linkedSelection: false,
  showWaveforms: true,
};

const TRACK_DEFAULTS = Object.freeze({ id: "video_track_1", locked: false, hidden: false, muted: false, solo: false });

const ICONS = Object.freeze({
  select: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 7-6 2.5 4 6-2.8 1.8-4-6L6 20 5 3z"/></svg>',
  scissors: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><path d="M8 7.5L20 18M8 16.5L20 6"/></svg>',
  trimStart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M16 7h-6M16 17h-6M10 7v10"/></svg>',
  trimEnd: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 4v16M8 7h6M8 17h6M14 7v10"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 14.5l5-5M10.5 6.5l1.3-1.3a4 4 0 015.7 5.6l-1.3 1.3M13.5 17.5l-1.3 1.3a4 4 0 01-5.7-5.6l1.3-1.3"/></svg>',
  duplicate: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V7a2 2 0 012-2h8"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.6-2.7 8-7 10-4.3-2-7-5.4-7-10V6l7-3z"/></svg>',
  graph: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16M6 15l4-5 4 3 4-7"/></svg>',
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7H4v5M5 11a8 8 0 111.8 5"/></svg>',
  redo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7h5v5M19 11a8 8 0 10-1.8 5"/></svg>',
  video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="11" height="10" rx="2"/><path d="M15 10l5-3v10l-5-3z"/></svg>',
  music: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18a3 3 0 11-2-2.8V6l10-2v11a3 3 0 11-2-2.8V8L9 9.2V18z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10" width="12" height="10" rx="2"/><path d="M9 10V7a3 3 0 016 0v3"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10" width="12" height="10" rx="2"/><path d="M9 10V7a3 3 0 015.5-1.7"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l16 16M9.8 5.5A9.8 9.8 0 0112 5c5.5 0 9 7 9 7a16 16 0 01-3 4M6.5 7.5A17 17 0 003 12s3.5 7 9 7a9.8 9.8 0 003.1-.5"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4zM17 9a4 4 0 010 6M19 6a8 8 0 010 12"/></svg>',
  muted: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4zM17 10l4 4M21 10l-4 4"/></svg>',
});

const els = {
  fileInput: document.getElementById("fileInput"),
  mediaSearch: document.getElementById("mediaSearch"),
  mediaTabs: Array.from(document.querySelectorAll(".media-tab")),
  mediaList: document.getElementById("mediaList"),
  mediaCount: document.getElementById("mediaCount"),
  timelineList: document.getElementById("timelineList"),
  timelineRuler: document.getElementById("timelineRuler"),
  audioTimelineList: document.getElementById("audioTimelineList"),
  trackLabels: document.querySelector(".track-labels"),
  trackArea: document.querySelector(".track-area"),
  durationReadout: document.getElementById("durationReadout"),
  previewVideo: document.getElementById("previewVideo"),
  emptyPreview: document.getElementById("emptyPreview"),
  playButton: document.getElementById("playButton"),
  seekSlider: document.getElementById("seekSlider"),
  timeReadout: document.getElementById("timeReadout"),
  statusText: document.getElementById("statusText"),
  exportButton: document.getElementById("exportButton"),
  projectButton: document.getElementById("projectButton"),
  jobButton: document.getElementById("jobButton"),
  saveButton: document.getElementById("saveButton"),
  loadButton: document.getElementById("loadButton"),
  undoButton: document.getElementById("undoButton"),
  redoButton: document.getElementById("redoButton"),
  selectToolButton: document.getElementById("selectToolButton"),
  splitButton: document.getElementById("splitButton"),
  trimStartButton: document.getElementById("trimStartButton"),
  trimEndButton: document.getElementById("trimEndButton"),
  linkButton: document.getElementById("linkButton"),
  timelineDuplicateButton: document.getElementById("timelineDuplicateButton"),
  timelineDeleteButton: document.getElementById("timelineDeleteButton"),
  shieldButton: document.getElementById("shieldButton"),
  waveformButton: document.getElementById("waveformButton"),
  timelinePanel: document.querySelector(".timeline-panel"),
  inspectorTabs: document.querySelector(".inspector-tabs"),
  inspectorEmpty: document.getElementById("inspectorEmpty"),
  clipForm: document.getElementById("clipForm"),
  audioForm: document.getElementById("audioForm"),
  clipName: document.getElementById("clipName"),
  clipRole: document.getElementById("clipRole"),
  clipSpeed: document.getElementById("clipSpeed"),
  clipStart: document.getElementById("clipStart"),
  clipEnd: document.getElementById("clipEnd"),
  clipMuted: document.getElementById("clipMuted"),
  clipScale: document.getElementById("clipScale"),
  clipX: document.getElementById("clipX"),
  clipY: document.getElementById("clipY"),
  clipRotation: document.getElementById("clipRotation"),
  clipOpacity: document.getElementById("clipOpacity"),
  narrationVolume: document.getElementById("narrationVolume"),
  musicVolume: document.getElementById("musicVolume"),
  duplicateButton: document.getElementById("duplicateButton"),
  deleteButton: document.getElementById("deleteButton"),
};

setToolbarIcons();

els.fileInput.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  setStatus(`Importing ${files.length} file${files.length === 1 ? "" : "s"}`);
  for (const file of files) {
    try {
      const asset = await createAsset(file);
      state.assets.push(asset);
      if (asset.kind === "video") addAssetToTimeline(asset);
    } catch (error) {
      setStatus(`Could not import ${file.name}: ${error.message}`);
    }
  }
  event.target.value = "";
  render();
  setStatus("Ready");
});

els.playButton.addEventListener("click", () => {
  if (state.isPlaying) {
    stopPreview();
  } else {
    playPreview();
  }
});

els.seekSlider.addEventListener("input", () => {
  const total = projectDuration();
  const seconds = (Number(els.seekSlider.value) / 1000) * total;
  seekPreview(seconds);
});

els.exportButton.addEventListener("click", exportWebM);
els.projectButton.addEventListener("click", downloadProjectJson);
els.jobButton.addEventListener("click", downloadBackendJobJson);
els.saveButton.addEventListener("click", saveLocalProject);
els.loadButton.addEventListener("click", loadLocalProject);
els.undoButton.addEventListener("click", undoEdit);
els.redoButton.addEventListener("click", redoEdit);
els.selectToolButton.addEventListener("click", () => setStatus("Select tool"));
els.splitButton.addEventListener("click", splitAtCursor);
els.trimStartButton.addEventListener("click", () => trimSelectedVideoToCursor("left"));
els.trimEndButton.addEventListener("click", () => trimSelectedVideoToCursor("right"));
els.linkButton.addEventListener("click", toggleLinkedSelection);
els.timelineDuplicateButton.addEventListener("click", duplicateSelectedItem);
els.timelineDeleteButton.addEventListener("click", deleteSelectedItem);
els.shieldButton.addEventListener("click", () => toggleVideoTrack("locked"));
els.waveformButton.addEventListener("click", toggleWaveformDisplay);
els.duplicateButton.addEventListener("click", duplicateSelectedItem);
els.deleteButton.addEventListener("click", deleteSelectedItem);
els.narrationVolume.addEventListener("input", () => updateTrackVolume("narration", els.narrationVolume.value));
els.musicVolume.addEventListener("input", () => updateTrackVolume("music", els.musicVolume.value));

els.mediaSearch.addEventListener("input", () => {
  state.mediaSearch = els.mediaSearch.value.trim().toLowerCase();
  renderMedia();
});

for (const tab of els.mediaTabs) {
  tab.addEventListener("click", () => {
    state.mediaFilter = tab.dataset.filter || "all";
    renderMedia();
  });
}

els.trackArea.addEventListener("click", (event) => {
  if (event.target.closest(".timeline-item, .audio-clip-pill, button")) return;
  seekPreview(secondsFromTrackPoint(event.clientX));
});
document.addEventListener("pointermove", resizeClipFromPointer);
document.addEventListener("pointerup", stopClipResize);
document.addEventListener("click", closeContextMenu);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeContextMenu();
});

for (const input of [
  els.clipName,
  els.clipRole,
  els.clipSpeed,
  els.clipStart,
  els.clipEnd,
  els.clipMuted,
  els.clipScale,
  els.clipX,
  els.clipY,
  els.clipRotation,
  els.clipOpacity,
]) {
  input.addEventListener("input", updateSelectedFromForm);
}

function createAsset(file) {
  if (file.type.startsWith("audio/")) return createAudioAsset(file);
  return createVideoAsset(file);
}

function createVideoAsset(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve({
        id: makeId("asset"),
        kind: "video",
        file,
        url,
        name: file.name,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("metadata read failed"));
    };
    video.src = url;
  });
}

function createAudioAsset(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      resolve({
        id: makeId("asset"),
        kind: "audio",
        file,
        url,
        name: file.name,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
        width: 0,
        height: 0,
      });
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("metadata read failed"));
    };
    audio.src = url;
  });
}

function addAssetToTimeline(asset) {
  if (asset.kind !== "video") return null;
  if (state.videoTrack.locked) {
    setStatus("Video track is locked");
    return null;
  }
  const item = {
    id: makeId("clip"),
    assetId: asset.id,
    name: asset.name,
    role: "",
    start: 0,
    end: roundTime(asset.duration),
    speed: 1,
    muted: false,
    transform: { ...DEFAULT_TRANSFORM },
  };
  state.timeline.push(item);
  return item;
}

function addAudioAssetToTrack(asset, trackKey) {
  if (asset.kind !== "audio") return null;
  const track = state.audioTracks[trackKey];
  if (track.locked) {
    setStatus(`${trackKey} track is locked`);
    return null;
  }
  const clip = {
    id: makeId("audio_clip"),
    assetId: asset.id,
    name: asset.name,
    timelineStart: 0,
    sourceStart: 0,
    duration: roundTime(asset.duration),
    volume: Number(track.volume),
  };
  track.clips.push(clip);
  return clip;
}

function render() {
  renderMedia();
  renderRuler();
  renderTrackLabels();
  renderTimeline();
  renderAudioTimeline();
  renderInspector();
  renderTransport(state.cursorSeconds);
  renderToolbarState();
  els.emptyPreview.classList.toggle("hidden", state.timeline.length > 0);
  applyTrackVisibility();
}

function renderRuler() {
  els.timelineRuler.innerHTML = "";
  const total = Math.max(projectDuration(), 20);
  const tickCount = 12;
  for (let index = 0; index < tickCount; index += 1) {
    const tick = document.createElement("div");
    tick.className = "ruler-tick";
    tick.textContent = formatTime((total / (tickCount - 1)) * index);
    els.timelineRuler.appendChild(tick);
  }
}

function renderMedia() {
  els.mediaCount.textContent = String(state.assets.length);
  els.mediaList.innerHTML = "";
  for (const tab of els.mediaTabs) {
    tab.classList.toggle("active", (tab.dataset.filter || "all") === state.mediaFilter);
  }
  const filteredAssets = state.assets.filter((asset) => {
    const matchesKind = state.mediaFilter === "all" || asset.kind === state.mediaFilter;
    const matchesSearch = !state.mediaSearch || asset.name.toLowerCase().includes(state.mediaSearch);
    return matchesKind && matchesSearch;
  });
  for (const asset of filteredAssets) {
    const row = document.createElement("article");
    row.className = "media-item";
    row.innerHTML = `
      <div>
        <div class="media-name" title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}</div>
        <div class="media-meta">${asset.kind} | ${formatTime(asset.duration)}${asset.kind === "video" ? ` | ${asset.width}x${asset.height}` : ""}</div>
      </div>
      <div class="media-actions"></div>
    `;
    const actions = row.querySelector(".media-actions");
    if (asset.kind === "video") {
      const addButton = makeMiniButton("+", `Add ${asset.name}`);
      addButton.addEventListener("click", () => {
        pushHistory();
        const item = addAssetToTimeline(asset);
        if (item) state.selectedItemId = item.id;
        render();
      });
      actions.appendChild(addButton);
    } else {
      for (const [label, trackKey] of [["Narr", "narration"], ["Music", "music"]]) {
        const addButton = makeMiniButton(label, `Add ${asset.name} to ${trackKey}`);
        addButton.addEventListener("click", () => {
          pushHistory();
          addAudioAssetToTrack(asset, trackKey);
          render();
        });
        actions.appendChild(addButton);
      }
    }
    els.mediaList.appendChild(row);
  }
}

function renderTimeline() {
  els.timelineList.innerHTML = "";
  els.durationReadout.textContent = formatTime(projectDuration());
  setPlayheadPosition();

  if (!state.timeline.length) {
    const empty = document.createElement("div");
    empty.className = "timeline-empty";
    empty.textContent = "No clips";
    els.timelineList.appendChild(empty);
    return;
  }

  state.timeline.forEach((item, index) => {
    const asset = assetForItem(item);
    const duration = clipTimelineDuration(item);
    const width = Math.max(150, Math.min(TRACK_PIXEL_WIDTH, (duration / Math.max(projectDuration(), 20)) * TRACK_PIXEL_WIDTH));
    const card = document.createElement("article");
    card.className = [
      "timeline-item",
      item.id === state.selectedItemId ? "selected" : "",
      item.id === state.activeItemId ? "active" : "",
      state.videoTrack.locked ? "locked" : "",
    ].join(" ");
    card.style.flexBasis = `${width}px`;
    card.draggable = true;
    card.draggable = !state.videoTrack.locked;
    card.innerHTML = `
      <span class="clip-resize-handle left" data-edge="left" aria-hidden="true"></span>
      <div>
        <div class="timeline-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
        <div class="timeline-meta">${formatTime(clipTimelineDuration(item))}${clipSpeed(item) !== 1 ? ` | ${clipSpeed(item)}x` : ""}${item.muted ? " | muted" : ""}</div>
      </div>
      <div class="timeline-meta">${escapeHtml(item.role || asset?.name || "clip")}</div>
      <span class="clip-resize-handle right" data-edge="right" aria-hidden="true"></span>
      <div class="timeline-controls">
        <button class="mini-button" data-action="left" aria-label="Move left"><</button>
        <button class="mini-button" data-action="right" aria-label="Move right">></button>
      </div>
    `;
    card.addEventListener("click", () => {
      state.selectedItemId = item.id;
      render();
    });
    card.addEventListener("contextmenu", (event) => openVideoContextMenu(event, item));
    card.addEventListener("dragstart", (event) => {
      if (state.videoTrack.locked) {
        event.preventDefault();
        setStatus("Video track is locked");
        return;
      }
      event.dataTransfer.setData("text/plain", item.id);
    });
    card.addEventListener("dragover", (event) => event.preventDefault());
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      moveItemToIndex(event.dataTransfer.getData("text/plain"), index);
    });
    card.querySelector('[data-action="left"]').addEventListener("click", (event) => {
      event.stopPropagation();
      moveItem(index, index - 1);
    });
    card.querySelector('[data-action="right"]').addEventListener("click", (event) => {
      event.stopPropagation();
      moveItem(index, index + 1);
    });
    for (const handle of card.querySelectorAll(".clip-resize-handle")) {
      handle.addEventListener("pointerdown", (event) => startVideoResize(event, item, handle.dataset.edge));
    }
    els.timelineList.appendChild(card);
  });
}

function renderAudioTimeline() {
  els.audioTimelineList.innerHTML = "";
  const total = Math.max(projectDuration(), 20);
  for (const [trackKey, track] of Object.entries(state.audioTracks)) {
    const row = document.createElement("div");
    row.className = "audio-track-row";
    const clipsContainer = document.createElement("div");
    clipsContainer.className = "audio-track-clips";
    if (!track.clips.length) {
      const empty = document.createElement("span");
      empty.className = "timeline-meta";
      empty.textContent = "No audio";
      clipsContainer.appendChild(empty);
    }
    track.clips.forEach((clip) => {
      const asset = state.assets.find((candidate) => candidate.id === clip.assetId);
      const left = (clip.timelineStart / total) * TRACK_PIXEL_WIDTH;
      const width = Math.max(160, Math.min(TRACK_PIXEL_WIDTH, (clip.duration / total) * TRACK_PIXEL_WIDTH));
      const pill = document.createElement("div");
      pill.className = `audio-clip-pill ${track.locked ? "locked" : ""}`;
      pill.style.left = `${left}px`;
      pill.style.width = `${width}px`;
      pill.title = asset?.name || clip.name;
      pill.innerHTML = `
        <span class="clip-resize-handle left" data-edge="left" aria-hidden="true"></span>
        <span class="audio-clip-label"></span>
        <span class="clip-resize-handle right" data-edge="right" aria-hidden="true"></span>
      `;
      pill.querySelector(".audio-clip-label").textContent = `${trackKey} · ${asset?.name || clip.name} · ${formatTime(clip.duration)}`;
      pill.addEventListener("click", (event) => {
        event.stopPropagation();
        setStatus(`${trackKey} audio selected: ${asset?.name || clip.name}`);
      });
      pill.addEventListener("contextmenu", (event) => openAudioContextMenu(event, trackKey, clip));
      for (const handle of pill.querySelectorAll(".clip-resize-handle")) {
        handle.addEventListener("pointerdown", (event) => startAudioResize(event, trackKey, clip, handle.dataset.edge));
      }
      clipsContainer.appendChild(pill);
    });
    const label = document.createElement("div");
    label.className = "audio-track-label";
    label.textContent = trackKey;
    row.append(label, clipsContainer);
    els.audioTimelineList.appendChild(row);
  }
}

function renderTrackLabels() {
  els.trackLabels.innerHTML = "";
  els.trackLabels.appendChild(makeVideoTrackLabel());
  for (const [trackKey, track] of Object.entries(state.audioTracks)) {
    els.trackLabels.appendChild(makeAudioTrackLabel(trackKey, track));
  }
  const spacer = document.createElement("div");
  spacer.className = "track-label spacer";
  els.trackLabels.appendChild(spacer);
}

function makeVideoTrackLabel() {
  const row = document.createElement("div");
  row.className = "track-label video-track-label";
  const typeIcon = makeTrackIcon("video", "Video track");
  const controls = document.createElement("span");
  controls.className = "track-controls";
  controls.append(
    makeTrackControl({
      iconName: state.videoTrack.locked ? "lock" : "unlock",
      active: state.videoTrack.locked,
      label: state.videoTrack.locked ? "Unlock video track" : "Lock video track",
      onClick: () => toggleVideoTrack("locked"),
    }),
    makeTrackControl({
      iconName: state.videoTrack.hidden ? "eyeOff" : "eye",
      active: !state.videoTrack.hidden,
      label: state.videoTrack.hidden ? "Show video track" : "Hide video track",
      onClick: () => toggleVideoTrack("hidden"),
    }),
    makeTrackControl({
      iconName: state.videoTrack.muted ? "muted" : "speaker",
      active: !state.videoTrack.muted,
      label: state.videoTrack.muted ? "Unmute source video audio" : "Mute source video audio",
      onClick: () => toggleVideoTrack("muted"),
    }),
    makeSoloButton(state.videoTrack.solo, () => toggleVideoTrack("solo"), "Solo video track"),
  );
  row.append(typeIcon, controls);
  return row;
}

function makeAudioTrackLabel(trackKey, track) {
  const row = document.createElement("div");
  row.className = "track-label audio-track-control-label";
  const typeIcon = makeTrackIcon("music", `${trackKey} audio track`);
  const controls = document.createElement("span");
  controls.className = "track-controls";
  controls.append(
    makeTrackControl({
      iconName: track.locked ? "lock" : "unlock",
      active: track.locked,
      label: track.locked ? `Unlock ${trackKey} track` : `Lock ${trackKey} track`,
      onClick: () => toggleAudioTrack(trackKey, "locked"),
    }),
    makeTrackControl({
      iconName: track.muted ? "muted" : "speaker",
      active: !track.muted,
      label: track.muted ? `Unmute ${trackKey} track` : `Mute ${trackKey} track`,
      onClick: () => toggleAudioTrack(trackKey, "muted"),
    }),
    makeSoloButton(track.solo, () => toggleAudioTrack(trackKey, "solo"), `Solo ${trackKey} track`),
  );
  row.append(typeIcon, controls);
  return row;
}

function makeTrackIcon(iconName, label) {
  const icon = document.createElement("span");
  icon.className = "track-type-icon";
  icon.innerHTML = ICONS[iconName];
  icon.setAttribute("aria-label", label);
  icon.setAttribute("role", "img");
  return icon;
}

function makeTrackControl({ iconName, active, label, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = active ? "active" : "";
  button.innerHTML = ICONS[iconName];
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

function makeSoloButton(active, onClick, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = active ? "active solo" : "solo";
  button.textContent = "S";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

function setToolbarIcons() {
  const icons = [
    [els.selectToolButton, "select"],
    [els.splitButton, "scissors"],
    [els.trimStartButton, "trimStart"],
    [els.trimEndButton, "trimEnd"],
    [els.linkButton, "link"],
    [els.timelineDuplicateButton, "duplicate"],
    [els.timelineDeleteButton, "trash"],
    [els.shieldButton, "shield"],
    [els.waveformButton, "graph"],
    [els.undoButton, "undo"],
    [els.redoButton, "redo"],
  ];
  for (const [button, iconName] of icons) {
    if (!button) continue;
    button.innerHTML = ICONS[iconName];
    button.setAttribute("aria-label", button.title);
  }
}

function renderToolbarState() {
  els.linkButton.classList.toggle("active", state.linkedSelection);
  els.shieldButton.classList.toggle("active", state.videoTrack.locked);
  els.waveformButton.classList.toggle("active", state.showWaveforms);
  els.timelinePanel.classList.toggle("waveforms-hidden", !state.showWaveforms);
  els.undoButton.disabled = state.history.length === 0;
  els.redoButton.disabled = state.future.length === 0;
}

function renderInspector() {
  const item = selectedItem();
  els.inspectorTabs.classList.toggle("hidden", !item);
  els.inspectorEmpty.classList.toggle("hidden", Boolean(item));
  els.clipForm.classList.toggle("hidden", !item);
  els.audioForm.classList.toggle("hidden", !item);
  if (!item) return;

  const asset = assetForItem(item);
  const transform = normalizeTransform(item.transform);
  els.clipName.value = item.name;
  els.clipRole.value = item.role;
  els.clipStart.max = asset ? String(asset.duration) : "";
  els.clipEnd.max = asset ? String(asset.duration) : "";
  els.clipStart.value = String(item.start);
  els.clipEnd.value = String(item.end);
  els.clipSpeed.value = String(clipSpeed(item));
  els.clipMuted.checked = item.muted;
  els.clipScale.value = String(transform.scale);
  els.clipX.value = String(transform.x);
  els.clipY.value = String(transform.y);
  els.clipRotation.value = String(transform.rotation);
  els.clipOpacity.value = String(transform.opacity);
  els.narrationVolume.value = String(state.audioTracks.narration.volume);
  els.musicVolume.value = String(state.audioTracks.music.volume);
  applyPreviewTransform(item);
  applyTrackVisibility();
}

function renderTransport(currentSeconds = state.cursorSeconds) {
  const total = projectDuration();
  state.cursorSeconds = clamp(currentSeconds, 0, total);
  els.playButton.textContent = state.isPlaying ? "Ⅱ" : "▶";
  els.seekSlider.value = total > 0 ? String(Math.round((state.cursorSeconds / total) * 1000)) : "0";
  els.timeReadout.textContent = `${formatTime(state.cursorSeconds)} / ${formatTime(total)}`;
  setPlayheadPosition();
}

function updateSelectedFromForm() {
  const item = selectedItem();
  if (!item) return;
  pushHistory();
  const asset = assetForItem(item);
  const maxEnd = asset ? asset.duration : item.end;
  const start = clamp(Number(els.clipStart.value) || 0, 0, maxEnd);
  const end = clamp(Number(els.clipEnd.value) || maxEnd, start + 0.05, maxEnd);
  item.name = els.clipName.value.trim() || asset?.name || "Untitled";
  item.role = els.clipRole.value.trim();
  item.start = roundTime(start);
  item.end = roundTime(end);
  item.speed = clamp(Number(els.clipSpeed.value) || 1, 0.25, 4);
  item.muted = els.clipMuted.checked;
  item.transform = {
    x: roundTime(Number(els.clipX.value) || 0),
    y: roundTime(Number(els.clipY.value) || 0),
    scale: clamp(Number(els.clipScale.value) || 1, 0.1, 2),
    rotation: roundTime(Number(els.clipRotation.value) || 0),
    opacity: clamp(Number(els.clipOpacity.value) || 1, 0, 1),
  };
  applyPreviewTransform(item);
  renderTimeline();
  renderTransport();
}

function updateTrackVolume(trackKey, value) {
  pushHistory();
  const track = state.audioTracks[trackKey];
  track.volume = Number(value);
  for (const clip of track.clips) clip.volume = track.volume;
  renderAudioTimeline();
}

async function playPreview(startSeconds = currentTimelineSeconds()) {
  if (!state.timeline.length) return;
  state.playToken += 1;
  state.isPlaying = true;
  state.cursorSeconds = startSeconds;
  const token = state.playToken;
  renderTransport(startSeconds);
  startAudioPreview(startSeconds, token);

  const startPosition = timelinePositionForSeconds(startSeconds);
  for (let index = startPosition.index; index < state.timeline.length; index += 1) {
    if (token !== state.playToken) return;
    const item = state.timeline[index];
    const offset = index === startPosition.index ? startPosition.offset : 0;
    await playPreviewItem(item, offset, token);
  }
  if (token === state.playToken) stopPreview(false);
}

function playPreviewItem(item, offset, token) {
  return new Promise(async (resolve) => {
    const asset = assetForItem(item);
    if (!asset) {
      resolve();
      return;
    }
    state.activeItemId = item.id;
    renderTimeline();
    applyPreviewTransform(item);
    const video = els.previewVideo;
    video.src = asset.url;
    video.muted = shouldMuteVideoItem(item);
    video.playbackRate = clipSpeed(item);
    await waitForEvent(video, "loadedmetadata");
    await seekVideo(video, item.start + offset * clipSpeed(item));
    try {
      await video.play();
    } catch {
      setStatus("Preview playback was blocked by the browser");
      stopPreview();
      resolve();
      return;
    }
    const tick = () => {
      if (token !== state.playToken || !state.isPlaying) {
        resolve();
        return;
      }
      const timelineSeconds = secondsBeforeItem(item.id) + Math.max(0, (video.currentTime - item.start) / clipSpeed(item));
      state.cursorSeconds = timelineSeconds;
      renderTransport(timelineSeconds);
      if (video.currentTime >= item.end || video.ended) {
        video.pause();
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function stopPreview(resetActive = true) {
  state.playToken += 1;
  state.isPlaying = false;
  els.previewVideo.pause();
  els.previewVideo.playbackRate = 1;
  if (resetActive) state.activeItemId = null;
  stopAudioPreview();
  applyPreviewTransform(selectedItem());
  render();
}

function seekPreview(seconds) {
  stopPreview();
  state.cursorSeconds = clamp(seconds, 0, projectDuration());
  const position = timelinePositionForSeconds(seconds);
  const item = state.timeline[position.index];
  if (!item) {
    renderTransport(state.cursorSeconds);
    return;
  }
  const asset = assetForItem(item);
  if (!asset?.url) {
    renderTransport(state.cursorSeconds);
    setStatus("Clip media is missing. Load or re-import the source file.");
    return;
  }
  state.selectedItemId = item.id;
  els.previewVideo.src = asset.url;
  els.previewVideo.muted = shouldMuteVideoItem(item);
  els.previewVideo.playbackRate = clipSpeed(item);
  applyPreviewTransform(item);
  waitForEvent(els.previewVideo, "loadedmetadata")
    .then(() => seekVideo(els.previewVideo, item.start + position.offset * clipSpeed(item)))
    .then(() => renderTransport(seconds));
}

async function exportWebM() {
  const videoTimeline = effectiveVideoTimeline();
  const audioTracks = effectiveAudioTracks();
  const { ir, errors, warnings } = buildRendererTimeline({
    assets: state.assets,
    timeline: videoTimeline,
    audioTracks,
  });
  if (errors.length) {
    setStatus(errors[0]);
    return;
  }
  stopPreview();
  els.exportButton.disabled = true;
  setStatus(warnings[0] || "Exporting in real time");
  try {
    const result = await MediaRecorderRenderer.render(ir);
    downloadBlob(result.blob, `manual-edit-${Date.now()}.${result.extension}`);
    setStatus("Export complete");
  } catch (error) {
    setStatus(error.message);
  } finally {
    els.exportButton.disabled = false;
  }
}

function downloadProjectJson() {
  const payload = buildEditorProject({ assets: state.assets, timeline: state.timeline, audioTracks: state.audioTracks });
  payload.timeline.videoTracks[0].locked = state.videoTrack.locked;
  payload.timeline.videoTracks[0].hidden = state.videoTrack.hidden;
  payload.timeline.videoTracks[0].muted = state.videoTrack.muted;
  payload.timeline.videoTracks[0].solo = state.videoTrack.solo;
  downloadJson(payload, "manual-editor-project.json");
}

function downloadBackendJobJson() {
  const { job, warnings } = buildPipelineJob({ assets: state.assets, timeline: effectiveVideoTimeline(), audioTracks: effectiveAudioTracks() });
  if (warnings.length) {
    setStatus(`Job JSON exported with ${warnings.length} compatibility warning${warnings.length === 1 ? "" : "s"}`);
  }
  downloadJson(job, "manual-timeline-job.json");
}

async function saveLocalProject() {
  setStatus("Saving local project");
  try {
    const db = await openProjectDb();
    const payload = {
      savedAt: new Date().toISOString(),
      assets: state.assets.map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        name: asset.name,
        duration: asset.duration,
        width: asset.width,
        height: asset.height,
        file: asset.file || null,
      })),
      editState: cloneEditableState(),
    };
    await putStoreValue(db, PROJECT_STORE, payload);
    db.close();
    setStatus("Local project saved");
  } catch (error) {
    setStatus(`Save failed: ${error.message}`);
  }
}

async function loadLocalProject() {
  setStatus("Loading local project");
  try {
    const db = await openProjectDb();
    const payload = await getStoreValue(db, PROJECT_STORE);
    db.close();
    if (!payload) {
      setStatus("No local project saved yet");
      return;
    }
    stopPreview();
    state.assets.forEach((asset) => {
      if (asset.url) URL.revokeObjectURL(asset.url);
    });
    state.assets = payload.assets.map((asset) => ({
      ...asset,
      url: asset.file ? URL.createObjectURL(asset.file) : "",
    }));
    restoreEditableState(payload.editState);
    state.history = [];
    state.future = [];
    render();
    setStatus(`Loaded local project from ${new Date(payload.savedAt).toLocaleString()}`);
  } catch (error) {
    setStatus(`Load failed: ${error.message}`);
  }
}

function startAudioPreview(startSeconds, token) {
  stopAudioPreview();
  const startedAt = performance.now() - startSeconds * 1000;
  for (const track of Object.values(effectiveAudioTracks())) {
    for (const clip of track.clips) {
      const asset = state.assets.find((candidate) => candidate.id === clip.assetId);
      if (!asset) continue;
      const clipEnd = clip.timelineStart + clip.duration;
      if (startSeconds >= clipEnd) continue;
      const delayMs = Math.max(0, (clip.timelineStart - startSeconds) * 1000);
      const timer = window.setTimeout(async () => {
        if (token !== state.playToken) return;
        const audio = document.createElement("audio");
        audio.src = asset.url;
        audio.volume = clamp(Number(clip.volume ?? track.volume), 0, 1);
        audio.currentTime = clip.sourceStart + Math.max(0, (performance.now() - startedAt) / 1000 - clip.timelineStart);
        state.audioPreviewElements.push(audio);
        try {
          await audio.play();
        } catch {
          return;
        }
        window.setTimeout(() => audio.pause(), Math.max(0, clipEnd - (performance.now() - startedAt) / 1000) * 1000);
      }, delayMs);
      state.audioPreviewTimers.push(timer);
    }
  }
}

function stopAudioPreview() {
  state.audioPreviewTimers.forEach((timer) => window.clearTimeout(timer));
  state.audioPreviewTimers = [];
  state.audioPreviewElements.forEach((audio) => audio.pause());
  state.audioPreviewElements = [];
}

function duplicateSelectedItem() {
  const item = selectedItem();
  if (!item) return;
  if (state.videoTrack.locked) {
    setStatus("Video track is locked");
    return;
  }
  const itemStart = secondsBeforeItem(item.id);
  const duration = clipTimelineDuration(item);
  pushHistory();
  const index = state.timeline.findIndex((clip) => clip.id === item.id);
  state.timeline.splice(index + 1, 0, { ...structuredClone(item), id: makeId("clip"), name: `${item.name} copy` });
  if (state.linkedSelection) duplicateLinkedAudioWindow(itemStart, duration);
  state.selectedItemId = state.timeline[index + 1].id;
  render();
}

function splitAtCursor() {
  if (state.videoTrack.locked) {
    setStatus("Video track is locked");
    return;
  }
  const position = timelinePositionForSeconds(state.cursorSeconds);
  const item = state.timeline[position.index];
  if (!item) return;
  const duration = clipTimelineDuration(item);
  const offset = clamp(position.offset, 0, duration);
  if (offset <= 0.05 || duration - offset <= 0.05) {
    setStatus("Move the playhead inside a clip before splitting");
    return;
  }
  pushHistory();
  const splitSourceTime = roundTime(item.start + offset * clipSpeed(item));
  const second = {
    ...structuredClone(item),
    id: makeId("clip"),
    name: `${item.name} part 2`,
    start: splitSourceTime,
  };
  item.end = splitSourceTime;
  state.timeline.splice(position.index + 1, 0, second);
  if (state.linkedSelection) splitLinkedAudioAtCursor();
  state.selectedItemId = second.id;
  render();
  setStatus("Clip split");
}

function deleteSelectedItem() {
  const index = state.timeline.findIndex((item) => item.id === state.selectedItemId);
  if (index < 0) return;
  if (state.videoTrack.locked) {
    setStatus("Video track is locked");
    return;
  }
  const item = state.timeline[index];
  const itemStart = secondsBeforeItem(item.id);
  const duration = clipTimelineDuration(item);
  pushHistory();
  state.timeline.splice(index, 1);
  if (state.linkedSelection) rippleDeleteLinkedAudioRange(itemStart, duration);
  state.selectedItemId = state.timeline[Math.min(index, state.timeline.length - 1)]?.id || null;
  render();
}

function duplicateAudioClip(trackKey, clipId) {
  const track = state.audioTracks[trackKey];
  const index = track?.clips.findIndex((clip) => clip.id === clipId) ?? -1;
  if (!track || index < 0) return;
  if (track.locked) {
    setStatus(`${trackKey} track is locked`);
    return;
  }
  pushHistory();
  const copy = structuredClone(track.clips[index]);
  copy.id = makeId("audio_clip");
  copy.name = `${copy.name} copy`;
  copy.timelineStart = roundTime(copy.timelineStart + copy.duration);
  track.clips.splice(index + 1, 0, copy);
  render();
}

function deleteAudioClip(trackKey, clipId) {
  const track = state.audioTracks[trackKey];
  const index = track?.clips.findIndex((clip) => clip.id === clipId) ?? -1;
  if (!track || index < 0) return;
  if (track.locked) {
    setStatus(`${trackKey} track is locked`);
    return;
  }
  pushHistory();
  track.clips.splice(index, 1);
  render();
}

function trimVideoToCursor(itemId, edge) {
  if (state.videoTrack.locked) {
    setStatus("Video track is locked");
    return;
  }
  const item = state.timeline.find((candidate) => candidate.id === itemId);
  const asset = item ? assetForItem(item) : null;
  if (!item || !asset) return;
  const itemStartOnTimeline = secondsBeforeItem(item.id);
  const sourceAtCursor = roundTime(item.start + (state.cursorSeconds - itemStartOnTimeline) * clipSpeed(item));
  if (sourceAtCursor <= item.start || sourceAtCursor >= item.end) {
    setStatus("Move the playhead inside this clip before trimming");
    return;
  }
  pushHistory();
  const originalDuration = clipTimelineDuration(item);
  if (edge === "left") {
    item.start = clamp(sourceAtCursor, 0, item.end - 0.05);
    if (state.linkedSelection) rippleDeleteLinkedAudioRange(itemStartOnTimeline, roundTime(originalDuration - clipTimelineDuration(item)));
  } else {
    const deletedStart = roundTime(itemStartOnTimeline + clipTimelineDuration({ ...item, end: sourceAtCursor }));
    item.end = clamp(sourceAtCursor, item.start + 0.05, asset.duration);
    if (state.linkedSelection) rippleDeleteLinkedAudioRange(deletedStart, roundTime(originalDuration - clipTimelineDuration(item)));
  }
  render();
}

function trimSelectedVideoToCursor(edge) {
  const item = selectedItem();
  if (!item) {
    setStatus("Select a video clip before trimming");
    return;
  }
  trimVideoToCursor(item.id, edge);
}

function splitLinkedAudioAtCursor() {
  for (const track of Object.values(state.audioTracks)) {
    if (track.locked) continue;
    for (let index = 0; index < track.clips.length; index += 1) {
      const clip = track.clips[index];
      const clipEnd = roundTime(clip.timelineStart + clip.duration);
      if (state.cursorSeconds <= clip.timelineStart + 0.05 || state.cursorSeconds >= clipEnd - 0.05) continue;
      const offset = roundTime(state.cursorSeconds - clip.timelineStart);
      const second = {
        ...structuredClone(clip),
        id: makeId("audio_clip"),
        name: `${clip.name} part 2`,
        timelineStart: roundTime(state.cursorSeconds),
        sourceStart: roundTime(clip.sourceStart + offset),
        duration: roundTime(clip.duration - offset),
      };
      clip.duration = offset;
      track.clips.splice(index + 1, 0, second);
      index += 1;
    }
  }
}

function duplicateLinkedAudioWindow(windowStart, duration) {
  const windowEnd = roundTime(windowStart + duration);
  const insertStart = windowEnd;
  for (const track of Object.values(state.audioTracks)) {
    if (track.locked) continue;
    const copies = [];
    for (const clip of track.clips) {
      const clipEnd = roundTime(clip.timelineStart + clip.duration);
      const overlapStart = Math.max(clip.timelineStart, windowStart);
      const overlapEnd = Math.min(clipEnd, windowEnd);
      if (overlapEnd - overlapStart > 0.05) {
        copies.push({
          ...structuredClone(clip),
          id: makeId("audio_clip"),
          name: `${clip.name} copy`,
          timelineStart: roundTime(insertStart + (overlapStart - windowStart)),
          sourceStart: roundTime(clip.sourceStart + (overlapStart - clip.timelineStart)),
          duration: roundTime(overlapEnd - overlapStart),
        });
      }
    }
    for (const clip of track.clips) {
      if (clip.timelineStart >= insertStart) {
        clip.timelineStart = roundTime(clip.timelineStart + duration);
      }
    }
    track.clips.push(...copies);
    track.clips.sort((left, right) => left.timelineStart - right.timelineStart);
  }
}

function rippleDeleteLinkedAudioRange(windowStart, duration) {
  if (duration <= 0.05) return;
  const windowEnd = roundTime(windowStart + duration);
  for (const track of Object.values(state.audioTracks)) {
    if (track.locked) continue;
    const nextClips = [];
    for (const clip of track.clips) {
      const clipStart = clip.timelineStart;
      const clipEnd = roundTime(clip.timelineStart + clip.duration);
      if (clipEnd <= windowStart) {
        nextClips.push(clip);
      } else if (clipStart >= windowEnd) {
        clip.timelineStart = roundTime(clip.timelineStart - duration);
        nextClips.push(clip);
      } else if (clipStart < windowStart && clipEnd > windowEnd) {
        const second = {
          ...structuredClone(clip),
          id: makeId("audio_clip"),
          name: `${clip.name} split`,
          timelineStart: roundTime(windowStart),
          sourceStart: roundTime(clip.sourceStart + (windowEnd - clipStart)),
          duration: roundTime(clipEnd - windowEnd),
        };
        clip.duration = roundTime(windowStart - clipStart);
        if (clip.duration > 0.05) nextClips.push(clip);
        if (second.duration > 0.05) nextClips.push(second);
      } else if (clipStart < windowStart) {
        clip.duration = roundTime(windowStart - clipStart);
        if (clip.duration > 0.05) nextClips.push(clip);
      } else if (clipEnd > windowEnd) {
        clip.sourceStart = roundTime(clip.sourceStart + (windowEnd - clipStart));
        clip.duration = roundTime(clipEnd - windowEnd);
        clip.timelineStart = roundTime(windowStart);
        if (clip.duration > 0.05) nextClips.push(clip);
      }
    }
    track.clips = nextClips.sort((left, right) => left.timelineStart - right.timelineStart);
  }
}

function trimAudioToCursor(trackKey, clipId, edge) {
  const track = state.audioTracks[trackKey];
  if (track?.locked) {
    setStatus(`${trackKey} track is locked`);
    return;
  }
  const clip = track?.clips.find((candidate) => candidate.id === clipId);
  const asset = clip ? state.assets.find((candidate) => candidate.id === clip.assetId) : null;
  if (!clip || !asset) return;
  const offset = roundTime(state.cursorSeconds - clip.timelineStart);
  if (offset <= 0 || offset >= clip.duration) {
    setStatus("Move the playhead inside this audio clip before trimming");
    return;
  }
  pushHistory();
  if (edge === "left") {
    clip.timelineStart = roundTime(state.cursorSeconds);
    clip.sourceStart = roundTime(clip.sourceStart + offset);
    clip.duration = roundTime(clip.duration - offset);
  } else {
    clip.duration = clamp(offset, 0.05, asset.duration - clip.sourceStart);
  }
  render();
}

function moveItem(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= state.timeline.length) return;
  if (state.videoTrack.locked) {
    setStatus("Video track is locked");
    return;
  }
  pushHistory();
  const [item] = state.timeline.splice(fromIndex, 1);
  state.timeline.splice(toIndex, 0, item);
  render();
}

function moveItemToIndex(itemId, toIndex) {
  const fromIndex = state.timeline.findIndex((item) => item.id === itemId);
  if (fromIndex < 0 || fromIndex === toIndex) return;
  moveItem(fromIndex, toIndex);
}

function startVideoResize(event, item, edge) {
  event.preventDefault();
  event.stopPropagation();
  if (state.videoTrack.locked) {
    setStatus("Video track is locked");
    return;
  }
  const asset = assetForItem(item);
  if (!asset) return;
  pushHistory();
  state.selectedItemId = item.id;
  state.resizeDrag = {
    kind: "video",
    edge,
    id: item.id,
    startX: event.clientX,
    secondsPerPixel: Math.max(projectDuration(), 20) / TRACK_PIXEL_WIDTH,
    speed: clipSpeed(item),
    originalStart: item.start,
    originalEnd: item.end,
    assetDuration: asset.duration,
  };
  document.body.classList.add("is-resizing-clip");
}

function startAudioResize(event, trackKey, clip, edge) {
  event.preventDefault();
  event.stopPropagation();
  const track = state.audioTracks[trackKey];
  if (track?.locked) {
    setStatus(`${trackKey} track is locked`);
    return;
  }
  const asset = state.assets.find((candidate) => candidate.id === clip.assetId);
  if (!asset) return;
  pushHistory();
  state.resizeDrag = {
    kind: "audio",
    edge,
    trackKey,
    id: clip.id,
    startX: event.clientX,
    secondsPerPixel: Math.max(projectDuration(), 20) / TRACK_PIXEL_WIDTH,
    originalTimelineStart: clip.timelineStart,
    originalSourceStart: clip.sourceStart,
    originalDuration: clip.duration,
    assetDuration: asset.duration,
  };
  document.body.classList.add("is-resizing-clip");
}

function resizeClipFromPointer(event) {
  if (!state.resizeDrag) return;
  const drag = state.resizeDrag;
  const delta = roundTime((event.clientX - drag.startX) * drag.secondsPerPixel);
  if (drag.kind === "video") {
    const item = state.timeline.find((candidate) => candidate.id === drag.id);
    if (!item) return;
    const sourceDelta = roundTime(delta * drag.speed);
    if (drag.edge === "left") {
      item.start = roundTime(clamp(drag.originalStart + sourceDelta, 0, drag.originalEnd - 0.05));
    } else {
      item.end = roundTime(clamp(drag.originalEnd + sourceDelta, drag.originalStart + 0.05, drag.assetDuration));
    }
    renderTimeline();
    renderTransport();
    renderInspector();
    return;
  }

  const track = state.audioTracks[drag.trackKey];
  const clip = track?.clips.find((candidate) => candidate.id === drag.id);
  if (!clip) return;
  if (drag.edge === "left") {
    const minDelta = -Math.min(drag.originalTimelineStart, drag.originalSourceStart);
    const maxDelta = drag.originalDuration - 0.05;
    const safeDelta = clamp(delta, minDelta, maxDelta);
    clip.timelineStart = roundTime(drag.originalTimelineStart + safeDelta);
    clip.sourceStart = roundTime(drag.originalSourceStart + safeDelta);
    clip.duration = roundTime(drag.originalDuration - safeDelta);
  } else {
    clip.duration = roundTime(clamp(drag.originalDuration + delta, 0.05, drag.assetDuration - drag.originalSourceStart));
  }
  renderAudioTimeline();
  renderTransport();
}

function stopClipResize() {
  if (!state.resizeDrag) return;
  state.resizeDrag = null;
  document.body.classList.remove("is-resizing-clip");
  render();
}

function openVideoContextMenu(event, item) {
  event.preventDefault();
  state.selectedItemId = item.id;
  render();
  openContextMenu(event.clientX, event.clientY, [
    { label: "Split at playhead", action: splitAtCursor },
    { label: "Trim start to playhead", action: () => trimVideoToCursor(item.id, "left") },
    { label: "Trim end to playhead", action: () => trimVideoToCursor(item.id, "right") },
    { label: item.muted ? "Unmute source audio" : "Mute source audio", action: () => toggleVideoMute(item.id) },
    { label: "Duplicate", action: duplicateSelectedItem },
    { label: "Delete", action: deleteSelectedItem, danger: true },
  ]);
}

function openAudioContextMenu(event, trackKey, clip) {
  event.preventDefault();
  openContextMenu(event.clientX, event.clientY, [
    { label: "Trim start to playhead", action: () => trimAudioToCursor(trackKey, clip.id, "left") },
    { label: "Trim end to playhead", action: () => trimAudioToCursor(trackKey, clip.id, "right") },
    { label: "Duplicate audio", action: () => duplicateAudioClip(trackKey, clip.id) },
    { label: "Delete audio", action: () => deleteAudioClip(trackKey, clip.id), danger: true },
  ]);
}

function openContextMenu(x, y, actions) {
  closeContextMenu();
  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    if (action.danger) button.classList.add("danger");
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      closeContextMenu();
      action.action();
    });
    menu.appendChild(button);
  }
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`;
}

function closeContextMenu() {
  document.querySelector(".context-menu")?.remove();
}

function toggleVideoMute(itemId) {
  if (state.videoTrack.locked) {
    setStatus("Video track is locked");
    return;
  }
  const item = state.timeline.find((candidate) => candidate.id === itemId);
  if (!item) return;
  pushHistory();
  item.muted = !item.muted;
  render();
}

function toggleVideoTrack(key) {
  pushHistory();
  state.videoTrack[key] = !state.videoTrack[key];
  const labels = {
    locked: state.videoTrack.locked ? "Video track locked" : "Video track unlocked",
    hidden: state.videoTrack.hidden ? "Video track hidden" : "Video track visible",
    muted: state.videoTrack.muted ? "Source video audio muted" : "Source video audio unmuted",
    solo: state.videoTrack.solo ? "Video track soloed" : "Video track solo off",
  };
  render();
  setStatus(labels[key] || "Video track updated");
}

function toggleAudioTrack(trackKey, key) {
  const track = state.audioTracks[trackKey];
  if (!track) return;
  pushHistory();
  track[key] = !track[key];
  const labels = {
    locked: track.locked ? `${trackKey} track locked` : `${trackKey} track unlocked`,
    muted: track.muted ? `${trackKey} muted` : `${trackKey} unmuted`,
    solo: track.solo ? `${trackKey} soloed` : `${trackKey} solo off`,
  };
  render();
  setStatus(labels[key] || `${trackKey} track updated`);
}

function toggleLinkedSelection() {
  state.linkedSelection = !state.linkedSelection;
  renderToolbarState();
  setStatus(state.linkedSelection ? "Linked selection on" : "Linked selection off");
}

function toggleWaveformDisplay() {
  state.showWaveforms = !state.showWaveforms;
  renderToolbarState();
  setStatus(state.showWaveforms ? "Waveforms shown" : "Waveforms hidden");
}

function undoEdit() {
  if (!state.history.length) return;
  state.future.push(cloneEditableState());
  const snapshot = state.history.pop();
  restoreEditableState(snapshot);
  render();
  setStatus("Undo");
}

function redoEdit() {
  if (!state.future.length) return;
  state.history.push(cloneEditableState());
  const snapshot = state.future.pop();
  restoreEditableState(snapshot);
  render();
  setStatus("Redo");
}

function pushHistory() {
  if (state.restoringHistory) return;
  state.history.push(cloneEditableState());
  if (state.history.length > 80) state.history.shift();
  state.future = [];
}

function cloneEditableState() {
  return structuredClone({
    videoTrack: state.videoTrack,
    timeline: state.timeline,
    audioTracks: state.audioTracks,
    selectedItemId: state.selectedItemId,
    cursorSeconds: state.cursorSeconds,
  });
}

function restoreEditableState(snapshot) {
  state.restoringHistory = true;
  state.videoTrack = normalizeVideoTrack(snapshot.videoTrack);
  state.timeline = structuredClone(snapshot.timeline || []);
  state.audioTracks = structuredClone(snapshot.audioTracks || {
    narration: { id: "narration_track", role: "narration", volume: 1, clips: [], locked: false, muted: false, solo: false },
    music: { id: "music_track", role: "music", volume: 0.35, clips: [], locked: false, muted: false, solo: false },
  });
  state.selectedItemId = snapshot.selectedItemId || null;
  state.activeItemId = null;
  state.cursorSeconds = Number(snapshot.cursorSeconds) || 0;
  state.restoringHistory = false;
}

function normalizeVideoTrack(track = {}) {
  return {
    ...structuredClone(TRACK_DEFAULTS),
    ...structuredClone(track || {}),
    id: track?.id || TRACK_DEFAULTS.id,
    locked: Boolean(track?.locked),
    hidden: Boolean(track?.hidden),
    muted: Boolean(track?.muted),
    solo: Boolean(track?.solo),
  };
}

function makeMiniButton(text, label) {
  const button = document.createElement("button");
  button.className = "mini-button";
  button.type = "button";
  button.textContent = text;
  button.setAttribute("aria-label", label);
  return button;
}

function selectedItem() {
  return state.timeline.find((item) => item.id === state.selectedItemId) || null;
}

function assetForItem(item) {
  return state.assets.find((asset) => asset.id === item.assetId) || null;
}

function timelineDuration() {
  return state.timeline.reduce((total, item) => total + clipTimelineDuration(item), 0);
}

function projectDuration() {
  const audioDuration = Object.values(state.audioTracks).reduce((max, track) => {
    return Math.max(max, ...track.clips.map((clip) => clip.timelineStart + clip.duration), 0);
  }, 0);
  return Math.max(timelineDuration(), audioDuration);
}

function shouldPlayVideoTrack() {
  const anySolo = state.videoTrack.solo || Object.values(state.audioTracks).some((track) => track.solo);
  if (state.videoTrack.hidden) return false;
  return !anySolo || state.videoTrack.solo;
}

function shouldMuteVideoItem(item) {
  return Boolean(item?.muted || state.videoTrack.muted || !shouldPlayVideoTrack());
}

function effectiveVideoTimeline() {
  if (!shouldPlayVideoTrack()) return [];
  return state.timeline.map((item) => ({
    ...structuredClone(item),
    muted: Boolean(item.muted || state.videoTrack.muted),
  }));
}

function effectiveAudioTracks() {
  const anySolo = state.videoTrack.solo || Object.values(state.audioTracks).some((track) => track.solo);
  return Object.fromEntries(Object.entries(state.audioTracks).map(([trackKey, track]) => {
    const shouldPlay = !track.muted && (!anySolo || track.solo);
    return [
      trackKey,
      {
        ...track,
        volume: shouldPlay ? track.volume : 0,
        clips: shouldPlay ? track.clips : [],
      },
    ];
  }));
}

function applyTrackVisibility() {
  els.previewVideo.classList.toggle("track-hidden", !shouldPlayVideoTrack());
}

function currentTimelineSeconds() {
  const item = state.timeline.find((clip) => clip.id === state.activeItemId);
  if (!item) return state.cursorSeconds;
  return secondsBeforeItem(item.id) + Math.max(0, (els.previewVideo.currentTime - item.start) / clipSpeed(item));
}

function secondsBeforeItem(itemId) {
  let seconds = 0;
  for (const item of state.timeline) {
    if (item.id === itemId) return seconds;
    seconds += clipTimelineDuration(item);
  }
  return seconds;
}

function timelinePositionForSeconds(seconds) {
  let remaining = clamp(seconds, 0, timelineDuration());
  for (let index = 0; index < state.timeline.length; index += 1) {
    const item = state.timeline[index];
    const duration = clipTimelineDuration(item);
    if (remaining <= duration || index === state.timeline.length - 1) {
      return { index, offset: remaining };
    }
    remaining -= duration;
  }
  return { index: 0, offset: 0 };
}

function clipSpeed(item) {
  return clamp(Number(item?.speed ?? 1) || 1, 0.25, 4);
}

function clipTimelineDuration(item) {
  return roundTime(Math.max(0, item.end - item.start) / clipSpeed(item));
}

function secondsFromTrackPoint(clientX) {
  const rect = els.trackArea.getBoundingClientRect();
  const scrollLeft = els.trackArea.scrollLeft || 0;
  const x = clamp(clientX - rect.left + scrollLeft, 0, TRACK_PIXEL_WIDTH);
  return roundTime((x / TRACK_PIXEL_WIDTH) * Math.max(projectDuration(), 20));
}

function setPlayheadPosition() {
  const total = Math.max(projectDuration(), 20);
  const left = clamp((state.cursorSeconds / total) * TRACK_PIXEL_WIDTH, 0, TRACK_PIXEL_WIDTH);
  els.trackArea.style.setProperty("--playhead-left", `${left}px`);
}

function normalizeTransform(transform) {
  return {
    ...DEFAULT_TRANSFORM,
    ...(transform || {}),
    scale: clamp(Number(transform?.scale ?? DEFAULT_TRANSFORM.scale), 0.1, 2),
    opacity: clamp(Number(transform?.opacity ?? DEFAULT_TRANSFORM.opacity), 0, 1),
    x: Number(transform?.x ?? DEFAULT_TRANSFORM.x) || 0,
    y: Number(transform?.y ?? DEFAULT_TRANSFORM.y) || 0,
    rotation: Number(transform?.rotation ?? DEFAULT_TRANSFORM.rotation) || 0,
  };
}

function applyPreviewTransform(item) {
  const transform = normalizeTransform(item?.transform);
  els.previewVideo.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`;
  els.previewVideo.style.opacity = String(transform.opacity);
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

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openProjectDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("manual-video-editor", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("projects");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local project database"));
  });
}

function putStoreValue(db, key, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("projects", "readwrite");
    transaction.objectStore("projects").put(value, key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Could not save local project"));
  });
}

function getStoreValue(db, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("projects", "readonly");
    const request = transaction.objectStore("projects").get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Could not load local project"));
  });
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const wholeSeconds = Math.floor(safeSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}`;
}

function roundTime(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
