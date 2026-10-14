# Plan: CHANGELOG fragments and gate-based releases

- **Status:** Approved (decisions 1A, 2B)
- **Date:** 2026-10-13
- **Scope:** Tooling, documentation, agent rules. No engine, data, or UI change.
- **Decision source:** Documentation audit, CHANGELOG options 1 + 3 accepted by the owner.

---

## 1. Problem

- `CHANGELOG.md` is about 2,700 lines. Only one release exists (`[0.1.0] - 2026-08-26`), so every change since then sits in `[Unreleased]`.
- There are two `## [Unreleased]` headings: one at the top of the file and one further down, above `[0.1.0]`.
- Parallel agent sessions edit the top of `CHANGELOG.md` at the same time, which conflicts. That happened during this audit, when the #304 session and the audit session both wrote to it.

## 2. Target model

1. **Change fragments (option 3).** Each change adds one file in `changes/unreleased/` instead of editing `CHANGELOG.md`. Parallel sessions then never touch the same file.
2. **Gate releases (option 1).** At a release, a script compiles the fragments into a new `## [X.Y.Z] - YYYY-MM-DD` section of `CHANGELOG.md` and deletes them.
   - Each roadmap gate is a minor version: Gate 1 "Rhino Release" = `0.2.0`, Gate 2 = `0.3.0`, and so on.
   - Cuts between gates are patch versions (`0.1.1`, `0.1.2`, …), whenever the owner asks.
   - This follows Keep a Changelog and SemVer, which `CHANGELOG.md` already claims to follow.

### Fragment format

File name: `changes/unreleased/<issue>-<short-slug>.md`, for example `304-100-game-simulation-gate.md`. If there is no issue, use the date: `2026-10-13-docs-audit.md`.

```markdown
---
type: Fixed
---

- **Fix (Engine): …([Issue #304](https://github.com/SteveRodrigue/MCD/issues/304))**
  - Detail line.
```

`type` must be one of the Keep a Changelog groups: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. The body is the same Markdown we write today.

## 3. File changes

| File | Change |
| :--- | :--- |
| `changes/unreleased/.gitkeep` | New. Keeps the folder in git. |
| `changes/README.md` | New. Short guide: file name, `type` values, one example. |
| `scripts/changelog-release.ts` | New. `tsx` script. Reads every fragment, validates `type`, groups entries under `### Added` / `### Changed` / … in that fixed order, inserts `## [X.Y.Z] - <today>` below `## [Unreleased]`, deletes the compiled fragments, and sets `package.json` `version`. Fails with a clear message on a bad `type`, an existing version, or no fragments. Supports `--dry-run`. |
| `package.json` | New scripts: `changelog:release` (`tsx scripts/changelog-release.ts`) and `changelog:check` (validate fragments only, no write). |
| `.github/workflows/ci.yml` | New step (decision 2B): run `npm run changelog:check`, and fail when the commit range changes files under `src/` but adds no file under `changes/unreleased/`. |
| `CHANGELOG.md` | One-time migration (see §4): merge the duplicate `[Unreleased]`, cut the catch-up release, and leave an empty `## [Unreleased]` with a pointer to `changes/unreleased/`. |
| `.agents/rules/post-task-checklist.md` | "Update `[Unreleased]`" becomes "add a fragment in `changes/unreleased/`". |
| `.agents/skills/{bug-fix,feature-delivery,execute-plan,commit-and-push,documentation-audit,dependabot}/SKILL.md` | Same wording change wherever they say to edit `CHANGELOG.md` `[Unreleased]`. |
| `CONTRIBUTING.md`, `README.md` | One line each on fragments and `npm run changelog:release`. |
| `tests/tools/changelog-release.test.ts` | New (see §5). |

Not changed: git tags. Creating and pushing a `vX.Y.Z` tag is a delivery step that the owner requests, never automatic.

## 4. One-time migration

1. Merge the two `## [Unreleased]` sections into one, keeping every entry in its current order.
2. Move all those entries into a catch-up release section. The existing entries are not regrouped under `### Added` / `### Fixed`: rewriting about 2,600 lines of history adds risk without adding value. A one-line note in the section says they predate the grouping.
3. Leave an empty `## [Unreleased]` at the top: "Pending changes live in `changes/unreleased/` until the next release."

## 5. Tests

`tests/tools/changelog-release.test.ts`, using a temporary directory with a fixture `CHANGELOG.md` and fragments:

- Groups fragments by `type` in Keep a Changelog order, and sorts by file name within each group.
- Inserts the new version section directly below `## [Unreleased]`; earlier sections are untouched byte for byte.
- Deletes the compiled fragments and keeps `.gitkeep`.
- Rejects an unknown `type`, a missing front matter block, and a version that already exists.
- `--dry-run` and `changelog:check` write nothing.

Gates: `rtk npm test`, `rtk npm run lint`, `rtk npm run typecheck`, `rtk npm run format:check`.

## 6. UI / Card Editor impact

None.

## 7. Decisions (owner, 2026-10-13: 1A, 2B)

1. **Catch-up version for the existing entries.**
   - **A (chosen):** `0.1.1 - 2026-10-13`. Keeps `0.2.0` for the Gate 1 release, as the gate model says.
   - B: keep them in `[Unreleased]` until Gate 1 ships as `0.2.0`. The file stays long until then.
2. **CI check.**
   - A: run `npm run changelog:check` in `ci.yml`, validating fragment format only.
   - **B (chosen):** also fail CI when a commit changes `src/` without adding a fragment. Stricter, but noisy for refactors.
3. **Option 4 (archive split).** Not part of this plan. Revisit once three or more releases exist.
