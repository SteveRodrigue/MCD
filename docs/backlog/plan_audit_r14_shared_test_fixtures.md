# Plan R14: Shared test fixtures; no test-only production entry points

> **Status:** Ready for implementation (R13 is done, so the fixtures do not encode the deprecated pointers).
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R14): F013.
> **Gate:** Tech Debt & Tooling. **Tier:** 1. **Estimate:** 1 day (fixture module + first 10 migrations + execution stack removal); the rest migrates when files are touched.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Problem

- 235 files reference `setupGame`; `cardCatalog.getCard('01001a')` (Spider-Man) appears in 153 test files; each file defines its own `buildGame` / `createMockState` / `newGame` (54 local builders). A change to setup touches hundreds of files.
- `tests/support/` holds `card-overrides.ts` (F005-A), `render-with-session.tsx` and `thaw-state.ts`; there is no shared game builder.
- The execution stack is dead production code. `executionStack` is never pushed outside tests: it is initialized to `[]` (`src/engine/state/game-setup.ts:237`) and read once in `src/engine/pipeline/actions/prompts.ts:82-88`, a routing block that can never fire. `pushExecutionFrame` / `peekExecutionFrame` / `popExecutionFrame` (`src/engine/pipeline/prompt-queue.ts:~285-326`) are used by 1 test file only. (F003 already removed `passActivePlayer`; `endPlayerPhase` is production code now.)

## Rules / spec analysis

Not a rules change. ADR-0032 describes the execution stack as designed but it was never wired up; the ADR gets an amendment note.

## Simplification & Refactor Check

- **One module** `tests/support/game-fixtures.ts`:
  - `newRhinoGame({ players?: 1 | 2, heroes?: [heroCode, altCode][], form?: 'hero' | 'alter-ego', hand?, tableau?, seed?, difficulty? })` wraps `setupGame` with `catalog: cardCatalog`, `scenarioId: 'rhino'`, `skipMulligan: true`. Defaults: p1 Spider-Man (`01001a`/`01001b`), p2 `01029a`/`01029b`, deck 10 x `01005`.
  - `dispatchOk(state, action)` asserts no error and returns the new state.
  - `heroCard(code)`, `abilityOf(code, id)` (replaces the local `ability()` helper).
  - For tests that arrange state by writing to it, use the existing `tests/support/thaw-state.ts`; do not duplicate it.
  - Merge the best local builders into it (`core-player-reverify.test.ts` `newGame`, `imminent-overload.test.ts` `newGame`); do not keep two styles in a file you touch.
- **Execution stack: delete, not keep.** `executionStack` has no production writer, so remove all of it:
  - `pushExecutionFrame` / `peekExecutionFrame` / `popExecutionFrame` and the `ExecutionFrame` import in `prompt-queue.ts`.
  - The `prompts.ts:82-88` routing block.
  - The `executionStack` field (`src/engine/models/state.ts:578`) and the `ExecutionFrame` interface (`state.ts:251-262`).
  - The `executionStack: []` init in `game-setup.ts:237`.
  - The `Execution Frame Stack Management` describe (lines 165-199) and the 3 imports in `tests/engine/resolution-stack-and-prompt-queue.test.ts`; keep the rest of that file.
  - Docs: amend ADR-0032 (lines ~46, 104-107) noting the stack was removed unused; update `docs/roadmap_and_milestones.md:86`.
- **Migration rule (decided: opportunistic):** migrate the 10 files below now; the rest when touched. Record the rule in `.agents/rules/coding-and-testing-rules.md`: new or touched tests use `tests/support/game-fixtures.ts`; no new local `buildGame` / `newGame` / `createMockState` that wraps `setupGame`.

### The 10 files (by `setupGame(` count)

1. `tests/engine/table-invariants-restricted-and-unicity.test.ts` (11)
2. `tests/engine/target-legality-requirements.test.ts` (10)
3. `tests/engine/universal-counter-engine.test.ts` (8)
4. `tests/engine/wakanda-forever-sequence.test.ts` (7)
5. `tests/engine/search-and-select-routing.test.ts` (7)
6. `tests/engine/search-multi-zone.test.ts` (6)
7. `tests/engine/scenario-setup-step14-hero-setup.test.ts` (6)
8. `tests/engine/game-setup.test.ts` (6)
9. `tests/engine/advanced-status-and-minion-modifiers.test.ts` (6)
10. `tests/engine/target-scopes-and-form-invariants.test.ts` (5)

`game-setup.test.ts` and `scenario-setup-step14-hero-setup.test.ts` test setup itself and may keep a direct `setupGame` call. If so, swap in the next highest: `restricted-keyword-limit.test.ts`, `cross-player-unicity.test.ts` (5 each).

## File changes

- New: `tests/support/game-fixtures.ts`.
- Edited tests: the 10 files above; `tests/engine/resolution-stack-and-prompt-queue.test.ts`.
- Edited source: `src/engine/pipeline/prompt-queue.ts`, `src/engine/pipeline/actions/prompts.ts`, `src/engine/models/state.ts`, `src/engine/state/game-setup.ts`.
- Edited docs/rules: `.agents/rules/coding-and-testing-rules.md`, `docs/decisions/0032-universal-resolution-stack-decision-prompt-queue-and-nested-interrupts.md`, `docs/roadmap_and_milestones.md`, `docs/backlog/teamwork_status_and_next_target.md` (R14 row done; delete this plan when finished, as R13 did).

## Tests

The migrated tests keep their assertions.

1. `rtk npx vitest run <the 10 files> tests/engine/resolution-stack-and-prompt-queue.test.ts`
2. `rtk npm run typecheck` and `rtk npm run lint` (once, after the last edit).
3. `rg -n "executionStack|ExecutionFrame" src tests` returns nothing.

The full suite runs in the pre-push hook.

## Open decisions

None.

## UI and Card Editor impact

None. `executionStack` is not read by `src/ui` or the Card Editor (the grep above covers `src`).

## Commit

`test: Shared game fixtures; drop unused execution stack` with `Refs AUD-20261017-232534 R14`.
