# Commercial Dependency Gate

This gate must be completed before any browser editor build is shipped commercially.

## Current Decision

The current browser editor has no third-party npm dependency tree. It uses browser APIs, local ES modules, and a local `package.json` only for module-mode checks.

Current bundled third-party runtime dependencies:

```text
None
```

Experimental external code:

```text
web/manual-editor/prototypes/mediabunny-prototype.js
```

The Mediabunny prototype is isolated and must not be included in production bundles until legal and dependency review is complete.

## Required Review Before Adding Dependencies

For every runtime dependency:

- Confirm license.
- Preserve license and copyright notices.
- Check transitive dependencies.
- Check bundled sample assets and demo media.
- Check whether commercial use has restrictions.
- Check whether source modifications trigger copyleft obligations.
- Check whether codecs create patent/licensing exposure.
- Record the dependency in the allow/block list below.

## Allow List

| Dependency | License | Allowed Use | Notes |
|---|---|---|---|
| Browser Web APIs | Browser platform | Allowed | No bundled third-party code |
| Mediabunny | MPL-2.0 | Prototype only | Prefer npm dependency, avoid source modification, complete legal review before production |
| WebAV | MIT | Evaluation only | Needs PoC and dependency audit |

## Block List Until Licensed Or Approved

| Dependency | Reason |
|---|---|
| FFmpeg.wasm | FFmpeg LGPL/GPL build and codec compliance must be reviewed first |
| Remotion | Company license may be required |
| OpenVideo | Custom company license may be required |
| Twick | Sustainable/custom license constraints |
| Full editor forks copied wholesale | Requires full transitive dependency, asset, and architecture audit |

## Release Checklist

Before commercial release:

```bash
npm ls --all
npm audit --omit=dev
```

If the app remains dependency-free, document that result in release notes.

If dependencies are added, generate:

- `THIRD_PARTY_NOTICES.md`
- dependency inventory
- license source links
- legal approval record
