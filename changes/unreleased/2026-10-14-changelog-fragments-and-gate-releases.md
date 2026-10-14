---
type: Added
---

- **Changelog Fragments & Gate-Based Releases Tooling**
  - Added `changes/unreleased/` directory and format specification for parallel agent change tracking.
  - Added `scripts/changelog-release.ts` compiler with validation, dry-run, and check modes.
  - Added `npm run changelog:release` and `npm run changelog:check` commands.
  - Enforced fragment existence in CI for `src/` modifications.
  - Performed one-time migration of `CHANGELOG.md` to version `0.1.1`.

