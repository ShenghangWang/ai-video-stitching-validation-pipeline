# OpenReel Integration Notes

## Upstream Strategy

Keep OpenReel code as close to upstream as practical. Product behavior should live in separate `@car-sales-video/*` packages first.

Preferred extension order:

1. Add product packages.
2. Add thin integration components in `apps/web`.
3. Modify OpenReel core only when a stable product requirement cannot be expressed outside it.

## First Integration Contract

`@car-sales-video/pipeline-adapter` exposes:

```ts
pipelineJobToOpenReelProject(job, options)
```

It maps pipeline clips to:

- OpenReel media placeholders
- video tracks
- clips with timing, trim, volume, transform, and metadata
- markers for car-sales pitch sections

## Metadata To Preserve

- `pipelineClipId`
- `sourcePath`
- `role`
- `carSalesSection`
- `confidence`
- `hidden`

This metadata is the bridge from algorithmic validation to human review.
