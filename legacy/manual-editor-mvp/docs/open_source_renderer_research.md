# Open Source Browser Renderer Research

Research date: 2026-06-23

This document evaluates open source browser video renderer/editor projects for commercial reuse.

This is an engineering assessment, not legal advice. Before shipping commercial software, legal counsel should review the final dependency list, license notices, codec patent exposure, and whether any hosted services or sample assets are included.

## Recommendation

Use open source libraries selectively, not by importing an entire full editor.

Recommended path:

1. Keep our own renderer-neutral timeline model.
2. Keep the current `MediaRecorderRenderer` as the lightweight MVP export backend.
3. Use `Mediabunny` as the preferred building block for the future full browser renderer.
4. Evaluate `WebAV` with a small proof of concept, but do not make it the core architecture until its API boundaries fit our timeline model.
5. Treat full editor projects such as OpenReel/KubeezCut as reference implementations unless a deeper audit confirms that their dependency graph, assets, and architecture fit our commercial product.

## Candidate Summary

| Project | What It Is | License Signal | Commercial Risk | Recommendation |
|---|---|---:|---:|---|
| Mediabunny | Browser media toolkit: demux/mux/decode/encode/transcode | MPL-2.0 | Medium-low | Best candidate for full renderer building block |
| WebAV | WebCodecs SDK for creating/editing video files | MIT | Low | Evaluate with PoC |
| OpenReel Video | Full browser editor with WebCodecs/WebGPU | MIT | Medium | Reference only until dependency audit |
| KubeezCut | Full Chromium-focused browser editor | MIT | Medium | Reference only until dependency audit |
| Omniclip | Browser editor components | MIT | Medium | Not enough audio maturity for our needs |
| MFX | Small WebCodecs/WebGL project | MIT | Medium | Useful reference, not foundation |
| Diffusion Studio Core | Browser video compositing engine | MPL-2.0 plus watermark/commercial key model | Medium-high | Consider paid license only after business approval |
| Remotion | Programmatic video renderer | custom company-license terms | High unless licensed | Avoid for this pure-browser commercial MVP |
| OpenVideo | Full editor/platform | custom free/company license | High unless licensed | Avoid without commercial license |
| Twick | React video editor SDK | sustainable/custom usage limits | High unless licensed | Avoid without explicit commercial clearance |
| FFmpeg.wasm | FFmpeg compiled to WASM | wrapper may be MIT; FFmpeg is LGPL/GPL depending build | High | Avoid for default browser renderer |

## Notes

### Mediabunny

Mediabunny is the strongest full-renderer building block because it focuses on the hard media primitives instead of imposing a full editor UI. Its repository describes it as a browser library for reading, writing, and converting media, including MP4/WebM, built with WebCodecs, with streaming I/O and muxing/demuxing support.

License: MPL-2.0.

Commercial implication:

- MPL-2.0 is generally commercial-use compatible, but it is weak/file-level copyleft.
- If we modify Mediabunny source files and distribute them, those modified files must remain available under MPL-2.0.
- To reduce compliance work, prefer using it as an npm dependency and avoid vendoring/modifying its source.

Decision:

```text
Preferred full-renderer dependency candidate.
```

### WebAV

WebAV is an SDK for creating/editing video files on the web platform using WebCodecs. Its repository shows an MIT license and positions the project as a lightweight SDK, not only a demo editor.

Commercial implication:

- MIT is usually friendly for commercial closed-source use when copyright/license notices are preserved.
- Still needs dependency audit before product release.

Decision:

```text
Run a proof of concept after the renderer interface is extracted.
```

### Full Editor Projects

OpenReel Video and KubeezCut are especially relevant because they are browser-based editors with WebCodecs/WebGPU claims and MIT license signals.

Why not directly adopt one immediately:

- A full editor brings its own project model, UI architecture, state management, shortcuts, asset handling, timeline assumptions, and dependency graph.
- Importing one wholesale could replace our architecture instead of extending it.
- MIT at the top-level repository is encouraging but not enough; transitive dependencies, bundled assets, AI integrations, sample media, and generated code still need auditing.

Decision:

```text
Use as references first. Reuse code only after a dependency and asset audit.
```

### Projects To Avoid Without Paid/Legal Clearance

Remotion, OpenVideo, Twick, and DesignCombo-style editors are not good default dependencies for this commercial pure-browser path because their terms are custom, unclear, or require paid licensing depending on company size/use case.

They may still be business options if management wants to buy a commercial license.

### FFmpeg.wasm

FFmpeg itself is LGPL by default but can become GPL depending on enabled components. Browser distribution of WASM binaries makes compliance and codec/patent questions more complex.

Decision:

```text
Do not use FFmpeg.wasm as the default renderer path.
Only consider it as an optional fallback after legal review and a known LGPL-only build.
```

## Final Decision

Do not sacrifice legal certainty for speed.

Proceed with:

```text
Own editor UI and timeline model
+ MediaRecorderRenderer for MVP
+ Mediabunny/WebCodecs full renderer prototype later
+ WebAV PoC as a secondary evaluation path
```

Do not proceed with:

```text
Copying a full editor wholesale
Using custom-license projects without paid clearance
Using FFmpeg.wasm by default
```
