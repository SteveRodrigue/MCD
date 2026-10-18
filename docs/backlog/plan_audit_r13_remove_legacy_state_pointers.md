# Plan R13: Remove the deprecated `state.villain` / `state.mainScheme` pointers

> **Status:** Proposed. **Deferred by the owner on 2026-10-17 to the multi-villain work (Gate 4).** Tier 3 (core state model).
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R13): F016. Issue [#215](https://github.com/SteveRodrigue/MCD/issues/215) (Gate 4); commits use `Fixes #215`.
> **Estimate:** 1 day (mostly a codemod). **Unblocks:** R14.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md). Start it together with #210–#214 (Wrecking Crew, multi-villain).

## Problem

`GameState.villain` and `GameState.mainScheme` (`src/engine/models/state.ts:607,614`) are `@deprecated` since ADR-0076; the source of truth is `state.villains` / `activeVillainId` and the main scheme collection. At `f6e470f`: 10 reads in `src` (sync helpers in `state.ts`), about 760 references in 116 test files. Each clone serialises the active villain and main scheme twice, and every write must keep both copies in sync (#194 class of bugs).

## Rules / spec analysis

Not a rules change. ADR-0076 (active villain id and multi-villain accessors).

## Simplification & Refactor Check

- **Codemod** tests: `state.villain` → `getActiveVillain(state)`, `state.mainScheme` → `getActiveMainScheme(state)`; writes (`state.villain.health = 5`) → through the accessor's returned object (same object reference). Variable names other than `state` (`s`, `game`, `next`, `result.state`) need the same rewrite; build the regex from an inventory (`rg -n "\.(villain|mainScheme)\b" tests`).
- **Delete** the two fields, their sync code in `setActiveVillain` / `replaceActiveMainScheme` / `cloneGameState`, and the fallbacks in `getActiveVillain`, `getVillainById`, `getMainSchemeById`.
- **Check** saved states: `sessionStorage` and dev snapshots written before the change contain the old fields; loading ignores unknown fields (verify) or drops the snapshot.

## File changes

`src/engine/models/state.ts`, about 116 test files (mechanical), `tests/support/*` helpers, `docs/decisions/0076-*.md` addendum, changelog fragment.

## Tests

- Typecheck finds every remaining read once the fields are gone.
- Full suite; `npm run simulate` unchanged.

## Open decisions

1. Owner restarts it with the multi-villain work (decided 2026-10-17); confirm at that time.

## UI and Card Editor impact

None if the UI already reads through the accessors (verify with `rg "\.villain\b|\.mainScheme\b" src/ui`).
