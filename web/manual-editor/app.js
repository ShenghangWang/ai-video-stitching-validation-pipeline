import { buildPipelineJob } from "./adapters/pipeline-job-adapter.js";
import { buildEditorProject } from "./model/project.js";
import { buildRendererTimeline } from "./model/timeline-ir.js";
import { MediaRecorderRenderer } from "./renderers/media-recorder-renderer.js";

const state = {
  assets: [],
  timeline: [],
  audioTracks: {
    narration: { id: "narration_track", role: "narration", volume: 1, clips: [] },
    music: { id: "music_track", role: "music", volume: 0.35, clips: [] },
  },
  selectedItemId: null,
  activeItemId: null,
  playToken: 0,
  isPlaying: false,
  audioPreviewTimers: [],
  audioPreviewElements: [],
};

const els = {
  fileInput: document.getElementById("fileInput"),
  mediaList: document.getElementById("mediaList"),
  mediaCount: document.getElementById("mediaCount"),
  timelineList: document.getElementById("timelineList"),
  timelineRuler: document.getElementById("timelineRuler"),
  audioTimelineList: document.getElementById("audioTimelineList"),
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
  inspectorTabs: document.querySelector(".inspector-tabs"),
  inspectorEmpty: document.getElementById("inspectorEmpty"),
  clipForm: document.getElementById("clipForm"),
  audioForm: document.getElementById("audioForm"),
  clipName: document.getElementById("clipName"),
  clipRole: document.getElementById("clipRole"),
  clipStart: document.getElementById("clipStart"),
  clipEnd: document.getElementById("clipEnd"),
  clipMuted: document.getElementById("clipMuted"),
  narrationVolume: document.getElementById("narrationVolume"),
  musicVolume: document.getElementById("musicVolume"),
  duplicateButton: document.getElementById("duplicateButton"),
  deleteButton: document.getElementById("deleteButton"),
};

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
  const total = timelineDuration();
  const seconds = (Number(els.seekSlider.value) / 1000) * total;
  seekPreview(seconds);
});

els.exportButton.addEventListener("click", exportWebM);
els.projectButton.addEventListener("click", downloadProjectJson);
els.jobButton.addEventListener("click", downloadBackendJobJson);
els.duplicateButton.addEventListener("click", duplicateSelectedItem);
els.deleteButton.addEventListener("click", deleteSelectedItem);
els.narrationVolume.addEventListener("input", () => updateTrackVolume("narration", els.narrationVolume.value));
els.musicVolume.addEventListener("input", () => updateTrackVolume("music", els.musicVolume.value));

for (const input of [els.clipName, els.clipRole, els.clipStart, els.clipEnd, els.clipMuted]) {
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
  if (asset.kind !== "video") return;
  state.timeline.push({
    id: makeId("clip"),
    assetId: asset.id,
    name: asset.name,
    role: "",
    start: 0,
    end: roundTime(asset.duration),
    muted: false,
  });
}

function addAudioAssetToTrack(asset, trackKey) {
  if (asset.kind !== "audio") return;
  const track = state.audioTracks[trackKey];
  track.clips.push({
    id: makeId("audio_clip"),
    assetId: asset.id,
    name: asset.name,
    timelineStart: 0,
    sourceStart: 0,
    duration: roundTime(asset.duration),
    volume: Number(track.volume),
  });
}

function render() {
  renderMedia();
  renderRuler();
  renderTimeline();
  renderAudioTimeline();
  renderInspector();
  renderTransport();
  els.emptyPreview.classList.toggle("hidden", state.timeline.length > 0);
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
  for (const asset of state.assets) {
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
        addAssetToTimeline(asset);
        state.selectedItemId = state.timeline[state.timeline.length - 1].id;
        render();
      });
      actions.appendChild(addButton);
    } else {
      for (const [label, trackKey] of [["Narr", "narration"], ["Music", "music"]]) {
        const addButton = makeMiniButton(label, `Add ${asset.name} to ${trackKey}`);
        addButton.addEventListener("click", () => {
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

  if (!state.timeline.length) {
    const empty = document.createElement("div");
    empty.className = "timeline-empty";
    empty.textContent = "No clips";
    els.timelineList.appendChild(empty);
    return;
  }

  state.timeline.forEach((item, index) => {
    const asset = assetForItem(item);
    const card = document.createElement("article");
    card.className = [
      "timeline-item",
      item.id === state.selectedItemId ? "selected" : "",
      item.id === state.activeItemId ? "active" : "",
    ].join(" ");
    card.draggable = true;
    card.innerHTML = `
      <div>
        <div class="timeline-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
        <div class="timeline-meta">${formatTime(item.end - item.start)}${item.muted ? " | muted" : ""}</div>
      </div>
      <div class="timeline-meta">${escapeHtml(item.role || asset?.name || "clip")}</div>
      <div class="timeline-controls">
        <button class="mini-button" data-action="left" aria-label="Move left"><</button>
        <button class="mini-button" data-action="right" aria-label="Move right">></button>
      </div>
    `;
    card.addEventListener("click", () => {
      state.selectedItemId = item.id;
      render();
    });
    card.addEventListener("dragstart", (event) => {
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
    els.timelineList.appendChild(card);
  });
}

function renderAudioTimeline() {
  els.audioTimelineList.innerHTML = "";
  for (const [trackKey, track] of Object.entries(state.audioTracks)) {
    const row = document.createElement("div");
    row.className = "audio-track-row";
    const clips = track.clips.map((clip) => {
      const asset = state.assets.find((candidate) => candidate.id === clip.assetId);
      const width = Math.max(160, Math.min(900, clip.duration * 42));
      return `<div class="audio-clip-pill" style="flex-basis:${width}px" title="${escapeHtml(asset?.name || clip.name)}">${escapeHtml(trackKey)} · ${escapeHtml(asset?.name || clip.name)} · ${formatTime(clip.duration)}</div>`;
    }).join("");
    row.innerHTML = `
      <div class="audio-track-label">${escapeHtml(trackKey)}</div>
      <div class="audio-track-clips">${clips || '<span class="timeline-meta">No audio</span>'}</div>
    `;
    els.audioTimelineList.appendChild(row);
  }
}

function renderInspector() {
  const item = selectedItem();
  els.inspectorTabs.classList.toggle("hidden", !item);
  els.inspectorEmpty.classList.toggle("hidden", Boolean(item));
  els.clipForm.classList.toggle("hidden", !item);
  els.audioForm.classList.toggle("hidden", !item);
  if (!item) return;

  const asset = assetForItem(item);
  els.clipName.value = item.name;
  els.clipRole.value = item.role;
  els.clipStart.max = asset ? String(asset.duration) : "";
  els.clipEnd.max = asset ? String(asset.duration) : "";
  els.clipStart.value = String(item.start);
  els.clipEnd.value = String(item.end);
  els.clipMuted.checked = item.muted;
  els.narrationVolume.value = String(state.audioTracks.narration.volume);
  els.musicVolume.value = String(state.audioTracks.music.volume);
}

function renderTransport(currentSeconds = 0) {
  const total = projectDuration();
  els.playButton.textContent = state.isPlaying ? "Ⅱ" : "▶";
  els.seekSlider.value = total > 0 ? String(Math.round((currentSeconds / total) * 1000)) : "0";
  els.timeReadout.textContent = `${formatTime(currentSeconds)} / ${formatTime(total)}`;
}

function updateSelectedFromForm() {
  const item = selectedItem();
  if (!item) return;
  const asset = assetForItem(item);
  const maxEnd = asset ? asset.duration : item.end;
  const start = clamp(Number(els.clipStart.value) || 0, 0, maxEnd);
  const end = clamp(Number(els.clipEnd.value) || maxEnd, start + 0.05, maxEnd);
  item.name = els.clipName.value.trim() || asset?.name || "Untitled";
  item.role = els.clipRole.value.trim();
  item.start = roundTime(start);
  item.end = roundTime(end);
  item.muted = els.clipMuted.checked;
  renderTimeline();
  renderTransport();
}

function updateTrackVolume(trackKey, value) {
  const track = state.audioTracks[trackKey];
  track.volume = Number(value);
  for (const clip of track.clips) clip.volume = track.volume;
  renderAudioTimeline();
}

async function playPreview(startSeconds = currentTimelineSeconds()) {
  if (!state.timeline.length) return;
  state.playToken += 1;
  state.isPlaying = true;
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
    const video = els.previewVideo;
    video.src = asset.url;
    video.muted = item.muted;
    await waitForEvent(video, "loadedmetadata");
    await seekVideo(video, item.start + offset);
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
      const timelineSeconds = secondsBeforeItem(item.id) + Math.max(0, video.currentTime - item.start);
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
  if (resetActive) state.activeItemId = null;
  stopAudioPreview();
  render();
}

function seekPreview(seconds) {
  stopPreview();
  const position = timelinePositionForSeconds(seconds);
  const item = state.timeline[position.index];
  if (!item) {
    renderTransport(0);
    return;
  }
  const asset = assetForItem(item);
  els.previewVideo.src = asset.url;
  els.previewVideo.muted = item.muted;
  waitForEvent(els.previewVideo, "loadedmetadata")
    .then(() => seekVideo(els.previewVideo, item.start + position.offset))
    .then(() => renderTransport(seconds));
}

async function exportWebM() {
  const { ir, errors, warnings } = buildRendererTimeline({
    assets: state.assets,
    timeline: state.timeline,
    audioTracks: state.audioTracks,
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
  downloadJson(payload, "manual-editor-project.json");
}

function downloadBackendJobJson() {
  const { job, warnings } = buildPipelineJob({ assets: state.assets, timeline: state.timeline, audioTracks: state.audioTracks });
  if (warnings.length) {
    setStatus(`Job JSON exported with ${warnings.length} compatibility warning${warnings.length === 1 ? "" : "s"}`);
  }
  downloadJson(job, "manual-timeline-job.json");
}

function startAudioPreview(startSeconds, token) {
  stopAudioPreview();
  const startedAt = performance.now() - startSeconds * 1000;
  for (const track of Object.values(state.audioTracks)) {
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
  const index = state.timeline.findIndex((clip) => clip.id === item.id);
  state.timeline.splice(index + 1, 0, { ...item, id: makeId("clip"), name: `${item.name} copy` });
  state.selectedItemId = state.timeline[index + 1].id;
  render();
}

function deleteSelectedItem() {
  const index = state.timeline.findIndex((item) => item.id === state.selectedItemId);
  if (index < 0) return;
  state.timeline.splice(index, 1);
  state.selectedItemId = state.timeline[Math.min(index, state.timeline.length - 1)]?.id || null;
  render();
}

function moveItem(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= state.timeline.length) return;
  const [item] = state.timeline.splice(fromIndex, 1);
  state.timeline.splice(toIndex, 0, item);
  render();
}

function moveItemToIndex(itemId, toIndex) {
  const fromIndex = state.timeline.findIndex((item) => item.id === itemId);
  if (fromIndex < 0 || fromIndex === toIndex) return;
  moveItem(fromIndex, toIndex);
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
  return state.timeline.reduce((total, item) => total + Math.max(0, item.end - item.start), 0);
}

function projectDuration() {
  const audioDuration = Object.values(state.audioTracks).reduce((max, track) => {
    return Math.max(max, ...track.clips.map((clip) => clip.timelineStart + clip.duration), 0);
  }, 0);
  return Math.max(timelineDuration(), audioDuration);
}

function currentTimelineSeconds() {
  const item = state.timeline.find((clip) => clip.id === state.activeItemId);
  if (!item) return 0;
  return secondsBeforeItem(item.id) + Math.max(0, els.previewVideo.currentTime - item.start);
}

function secondsBeforeItem(itemId) {
  let seconds = 0;
  for (const item of state.timeline) {
    if (item.id === itemId) return seconds;
    seconds += Math.max(0, item.end - item.start);
  }
  return seconds;
}

function timelinePositionForSeconds(seconds) {
  let remaining = clamp(seconds, 0, timelineDuration());
  for (let index = 0; index < state.timeline.length; index += 1) {
    const item = state.timeline[index];
    const duration = Math.max(0, item.end - item.start);
    if (remaining <= duration || index === state.timeline.length - 1) {
      return { index, offset: remaining };
    }
    remaining -= duration;
  }
  return { index: 0, offset: 0 };
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
