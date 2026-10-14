# Changelog Fragments

Pending changes are tracked as individual fragment files in `changes/unreleased/` rather than editing `CHANGELOG.md` directly. At release time, fragments are compiled into `CHANGELOG.md` via `npm run changelog:release -- <version>`.

## File Naming

Name your fragment file:

- `changes/unreleased/<issue>-<short-slug>.md` (e.g. `304-100-game-simulation-gate.md`)
- If there is no issue number, use the date: `changes/unreleased/YYYY-MM-DD-<short-slug>.md` (e.g. `2026-10-13-docs-audit.md`)

## Fragment Format

Each fragment must begin with a YAML front matter block specifying the Keep a Changelog `type`:

```markdown
---
type: Fixed
---

- **Fix (Engine): Concise description ([Issue #304](https://github.com/SteveRodrigue/MCD/issues/304))**
  - Detail line describing specific behavior or implementation.
```

### Allowed `type` Values

The `type` must be one of the six Keep a Changelog groups:

- `Added` — for new features.
- `Changed` — for changes in existing functionality.
- `Deprecated` — for soon-to-be removed features.
- `Removed` — for now removed features.
- `Fixed` — for bug fixes.
- `Security` — for vulnerability fixes.

## Validation & Release

- Validate pending fragments without writing: `npm run changelog:check`
- Compile fragments into a new release: `npm run changelog:release -- <version>` (e.g. `npm run changelog:release -- 0.2.0`)
- Dry-run compilation: `npm run changelog:release -- <version> --dry-run`
