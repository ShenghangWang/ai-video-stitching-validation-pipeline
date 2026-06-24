# AI Car Sales Video Editor

Browser-first AI video editing product for turning a walk-around car video into a sales pitch video.

This repo is being migrated from a standalone Python stitching validation pipeline into an OpenReel-based editor product. OpenReel is now the editor foundation; the previous custom manual editor is archived as a legacy MVP.

## Product Direction

```text
walk-around car video
  -> stitching and validation pipeline
  -> car-sales timeline adapter
  -> OpenReel browser editor
  -> user review and light edits
  -> browser export
```

## Repository Layout

- `apps/web` - OpenReel browser editor app, to be customized for the car-sales workflow.
- `packages/core`, `packages/ui`, `packages/image-core` - OpenReel editor packages.
- `packages/car-sales-workflow` - product-specific sales pitch structure and section logic.
- `packages/pipeline-adapter` - converts stitching pipeline output into an OpenReel project draft.
- `services/stitching-pipeline` - existing Python AI video stitching validation pipeline.
- `legacy/manual-editor-mvp` - frozen custom manual editor MVP kept for reference only.
- `docs/upstream/openreel` - upstream OpenReel README, contributing guide, and MIT license.

## Local Development

Install the editor workspace:

```bash
pnpm install
```

Run the OpenReel editor:

```bash
pnpm dev
```

Run the Python pipeline tests:

```bash
pnpm pipeline:test
```

## Migration Rule

Do not continue feature work in `legacy/manual-editor-mvp`. New editor work should target OpenReel packages or product-specific packages layered on top of OpenReel.
