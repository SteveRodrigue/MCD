# [ADR-0088] Engine Kernel: Late-Bound Entry Points for the Rules' Recursion

- **Status:** Accepted
- **Date:** 2026-10-20
- **Authors:** MCD Core Team
- **Deciders:** Owner & Claude
- **Related Issues:** Code audit AUD-20261017-232534, finding F014-C (Plan R11); follows ADR-0085, ADR-0086, ADR-0087

---

## Context and Problem Statement

The runtime imports of `src/engine` (type-only imports ignored) formed one strongly connected component of 31 modules (effects and their handlers, triggers, eleven pipeline modules, the scenario modules) plus three smaller cycles. The rules recurse (triggers execute effects, effects dispatch triggers, pipeline steps call both), and the cycle worked only because no module called into it while loading. ADR-0085 had to import the handler registry last, and a first attempt to drop the load-time `registerFinishDamagePlacementsHook` call changed the load order and broke 18 tests that mock `trigger-dispatcher`.

## Decision Drivers

- No load-order dependency between engine modules.
- A test can wrap one recursion point without `vi.mock` of a whole module.
- One mechanism for late binding, with a check that fails when a cycle comes back.

## Considered Options

1. **Kernel with late binding (chosen).**
2. Leaf `core/` modules only (audit F014-C): does not remove the recursion, so the big cycle stays.
3. Accept the cycle and guard load-time calls with a test.

## Decision Outcome

**Chosen option 1, plus leaf extraction where a query was misplaced.**

- `src/engine/kernel.ts` is a leaf (type imports only). It holds the typed entries `kernel.executeEffect`, `kernel.dispatchTrigger`, `kernel.enqueueDecisionPrompt`, `kernel.dispatchAction` and the other recursion points (`KERNEL_ENTRIES`). An unbound entry throws a clear error.
- The module that owns an entry binds it with `bindKernel({...})` at the end of its file. `src/engine/boot.ts` loads every owner (and registers the Wakanda Forever special and the scenario plugins); `engine/index.ts` imports it, and `tests/setup/boot-kernel.ts` loads it for tests that import a single module.
- Calls that close a cycle use `kernel.<entry>(...)`; direct calls stay for everything else. `registerFinishDamagePlacementsHook` is replaced by `kernel.finishPendingDamagePlacements`.
- The Crisis queries (`getCrisisIconCount`, `countCrisisIconsInPlay`, `hasCrisisInPlay`) moved from `legality-checker.ts` to the leaf `pipeline/crisis.ts`, which ended the `target-resolver` ↔ `legality-checker` cycle.
- `tools/audit/import-cycles.ts` (`npm run audit:import-cycles`) builds the runtime import graph and finds the strongly connected components; `tests/tools/import-cycles.test.ts` fails when `src/engine` has any (ratchet 0).
- Tests wrap an entry with `spyKernel` / `recordDispatchedTriggers` (`tests/helpers/kernel-spy.ts`); the setup file restores them after every test. The six `vi.mock` of `trigger-dispatcher` and the `vi.spyOn` in `villain-phase-order.test.ts` use them.

## Consequences

- The kernel is module-level state, unlike the catalog of ADR-0087. It is set once at boot and never changes in play; tests that replace an entry restore it automatically.
- An entry point that imports a single engine module (not the `engine` barrel) must import `engine/boot` first; the unbound error says so.
- `stat-calculator` calls `evaluateDynamicAmount` and `evaluateStepGate` through the kernel, because both call back into it.
- A new recursion that closes a cycle is caught by the cycle test; the fix is a new kernel entry or a leaf module, not a load-order comment.

## Known limits

- **Audit coverage.** `audit:import-cycles` scans `src/engine` and follows relative and `@engine/…` imports only. A cycle that leaves the engine through `@data`, `@ui` or `@assets` and re-enters it is not detected. Tracked in [#339](https://github.com/SteveRodrigue/MCD/issues/339).
- **Double binding.** `bindKernel` does not reject a second binding of an entry; the later one wins. A strict throw would break dev-server hot reload, which re-evaluates an owner module and binds its entries again. Each entry has one owner file, so a duplicate means a copy-pasted `bindKernel` call. A guard, if ever needed, must allow re-binding from the same module.
