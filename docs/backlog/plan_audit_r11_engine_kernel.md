# Plan R11: Engine kernel to break the import cycle

> **Status:** Proposed. **Tier 3 (structural): owner design decision required before any code.**
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R11): F014 option C; architecture move M4. Attempted during F010-A and reverted.
> **Gate:** Tech Debt & Tooling. **Estimate:** 3+ days. **Depends on:** R10 decision (the kernel is where the catalog would be wired).
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Problem

Runtime imports in `src/engine` (type-only imports ignored) form one strongly connected component of **31 modules**: `effects/index.ts` and the 8 handler modules, `effects/target-choice.ts`, `triggers/index.ts`, `triggers/trigger-dispatcher.ts`, 11 `pipeline/` modules (boost, combat, damage, obligations, elimination, player phase, prompt queue, round upkeep, scenario helpers, threat, villain phase), 6 scenario modules, `specials/special-registry.ts` and `specials/wakanda-forever.ts`. Two smaller cycles: `dynamic-formula-evaluator` ↔ `stat-calculator` ↔ `step-gate-evaluator`, and `target-resolver` ↔ `legality-checker`.

The cycle exists because the rules recurse: triggers execute effects, effects dispatch triggers, pipeline steps call both. It works only because no module calls into the cycle while loading. The F010-A registry had to be imported last in `effects/index.ts` for that reason (ADR-0085, Consequences).

**Failed attempt (F010-A, reverted):** replacing the load-time `registerFinishDamagePlacementsHook` call with a direct import changed the load order, and 18 tests that mock `trigger-dispatcher` with `vi.mock(..., importOriginal)` started binding the real module.

## Rules / spec analysis

Not a rules change.

## Design options (owner picks one)

| Option                                           | What changes                                                                                                                                                                                         | Pros                                                                                                | Cons                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **A. Kernel with late binding (recommended)**    | `src/engine/kernel.ts` exposes `{ executeStep, dispatchTrigger, runPipeline… }` as an object filled at boot; recursive call sites call `kernel.dispatchTrigger(...)` instead of importing the module | Breaks the cycle at the recursion points only; tests can swap one kernel entry instead of `vi.mock` | Every recursive call site changes; tests that `vi.mock` these modules move to kernel stubs |
| B. Leaf `engine/core/` primitives (audit F014-C) | Move shared helpers (discard, damage application, log) into leaf modules                                                                                                                             | Smaller                                                                                             | Already tried for helpers: does not remove the recursion, so the big cycle stays           |
| C. Accept the cycle                              | Add a guard test that fails if a module calls into the cycle at load                                                                                                                                 | Zero refactor                                                                                       | Load-order fragility stays                                                                 |

## Simplification & Refactor Check (option A)

- **Delete** the load-time hook registrations (`registerFinishDamagePlacementsHook` and similar; list them with `rg -n "^register|^\s*register\w+Hook\(" src/engine`) in favour of kernel entries.
- **Merge** the hook registries into the kernel object; no second registration mechanism.
- **Add** a cycle check tool (`tools/audit/import-cycles.ts`, Tarjan SCC over runtime imports) and a test asserting the SCC size stays at 0 (or below a ratchet) after the change.
- Migrate the 18 `importOriginal` mocks to kernel stubs in the same change.

## File changes

`src/engine/kernel.ts` (new), recursive call sites in `effects/`, `triggers/`, `pipeline/`, `scenarios/`, `specials/`; affected tests; `tools/audit/import-cycles.ts` (new); new ADR (kernel wiring), ADR-0085 addendum (import order note becomes obsolete).

## Tests

- Cycle check test (new).
- Full engine suite; `npm run simulate` unchanged (same seed → same final state).

## Open decisions

1. Option A, B or C.
2. Together with R10 (catalog wired through the kernel) or separately.

## UI and Card Editor impact

None.
