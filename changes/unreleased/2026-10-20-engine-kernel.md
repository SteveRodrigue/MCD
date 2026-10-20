---
type: Changed
---

- **Change (Engine): Engine kernel breaks the runtime import cycles (AUD-20261017-232534 F014-C, ADR-0088)**
  - The 31-module import cycle in `src/engine` (and three smaller ones) is gone. Recursive calls (`executeEffect`, `dispatchTrigger`, `enqueueDecisionPrompt`, `dispatchAction`, ...) go through the late-bound `kernel` in `src/engine/kernel.ts`, bound by `src/engine/boot.ts`; the load-time hook registration and the import-order note of ADR-0085 are removed.
  - The Crisis queries moved to `pipeline/crisis.ts`. `npm run audit:import-cycles` and `tests/tools/import-cycles.test.ts` keep `src/engine` free of import cycles; tests wrap a kernel entry with `tests/helpers/kernel-spy.ts` instead of `vi.mock`.
