# Architecture

## Goal

The product goal is to let a user upload a single walk-around car video and receive an editable sales pitch video draft.

## System Shape

```text
services/stitching-pipeline
  Python validation and clip ordering pipeline

packages/pipeline-adapter
  Converts pipeline jobs/results into OpenReel project data

packages/car-sales-workflow
  Car sales pitch sections, roles, and timeline planning rules

apps/web
  OpenReel browser editor customized around the AI-generated draft
```

## Boundary

The Python pipeline should not know about React components or editor UI state. The browser editor should not directly depend on Python internals.

The integration contract is:

```text
pipeline job/result JSON -> pipeline adapter -> OpenReel Project
```

This keeps the AI pipeline testable and lets the editor evolve with OpenReel.
