export async function loadMediabunnyPrototype() {
  return import("https://cdn.jsdelivr.net/npm/mediabunny/+esm");
}

export async function inspectWithMediabunny(file) {
  const mediabunny = await loadMediabunnyPrototype();
  return {
    loaded: true,
    moduleKeys: Object.keys(mediabunny).sort(),
    fileName: file.name,
    fileSize: file.size,
  };
}
