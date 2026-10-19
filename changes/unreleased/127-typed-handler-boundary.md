---
type: Changed
---

- **Refactor (Engine): Removed unchecked step casts at the effect-handler boundary ([Issue #127](https://github.com/SteveRodrigue/MCD/issues/127), R5b)**
  - Added `isStep` narrowing and `getRuntimeParams`; `getStepEffectParams` is typed per effect and returns `Record<string, unknown>` for unnarrowed steps. A lint rule bans `as TypedStep<...>`.
  - Declared `ignoresCrisis` on `REMOVE_THREAT`. Removed unused param keys (`baseAmount`, `piercing`, `preventAll`, `amountPerPlayer`, `promptDescription`) and the dead `HEALTH` stat bonus path.
