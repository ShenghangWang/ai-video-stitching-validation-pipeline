# Commercial License Audit

## Current Decision

OpenReel Video is used as the browser editor foundation. The copied upstream license is MIT and is preserved at `docs/upstream/openreel/LICENSE`.

## Required Before Commercial Release

- Review all direct dependencies in root and package-level `package.json` files.
- Review transitive licenses from the lockfile.
- Confirm whether any OpenReel optional services, examples, or infrastructure files imply third-party service terms.
- Keep OpenReel copyright and MIT permission notices in distributed source or binary notices.
- Track product-specific modifications separately from upstream code.

## Current Risk Notes

- Root package is marked `UNLICENSED` because this is a private commercial product workspace.
- OpenReel-derived code remains subject to MIT notice obligations.
- The legacy manual editor is frozen and should not become the production editor base.
