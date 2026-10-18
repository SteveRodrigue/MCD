# Plan R14: Shared test fixtures; no test-only production entry points

> **Status:** Proposed. **Deferred:** starts after R13 (so the fixtures do not encode the deprecated pointers).
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R14): F013.
> **Gate:** Tech Debt & Tooling. **Tier:** 1. **Estimate:** 1 day (fixture module + first 10 migrations); the rest migrates when files are touched.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Problem

- 226 test files call `setupGame` directly; `cardCatalog.getCard('01001a')` (Spider-Man) appears 160 times in 148 files; each file defines its own `buildGame` / `createMockState` / `newGame`. A change to setup touches hundreds of files.
- `tests/support/` holds only `card-overrides.ts` (F005-A).
- Test-only production entry points: `pushExecutionFrame` / `peekExecutionFrame` / `popExecutionFrame` (`src/engine/pipeline/prompt-queue.ts:298-326`) are used by 1 test file and no production code. (F003 already removed `passActivePlayer`; `endPlayerPhase` is production code now.)

## Rules / spec analysis

Not a rules change.

## Simplification & Refactor Check

- **One module** `tests/support/game-fixtures.ts`: `newRhinoGame({ heroes, difficulty, hand, tableau, seed })`, `dispatchOk(state, action)` (asserts no error, returns state), `heroCard(code)`, `abilityOf(code, id)`. Merge the best local builders into it; do not keep two styles in a file you touch.
- **Execution frames:** delete the three functions and their test if `executionStack` is only read in production (check `rg -n "executionStack" src`); otherwise test through `dispatchAction`.
- **Migration rule:** migrate the 10 heaviest files now (by `setupGame` count), the rest when touched; record the rule in `.agents/rules/coding-and-testing-rules.md`.

## File changes

`tests/support/game-fixtures.ts` (new), 10 test files, `src/engine/pipeline/prompt-queue.ts`, `.agents/rules/coding-and-testing-rules.md`.

## Tests

The migrated tests keep their assertions; run `rtk npx vitest run <migrated files>`.

## Open decisions

1. Opportunistic migration after the first 10 (recommended) or migrate all 226 files in one change.

## UI and Card Editor impact

None.

## Commit

`test: Shared game fixtures; drop test-only execution frame helpers` with `Refs AUD-20261017-232534 R14`.
