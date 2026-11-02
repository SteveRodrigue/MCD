---
type: Fixed
---

- **Fix (Engine): Simulator `installInPlay` stages attachments without damaging host ([Issue #529](https://github.com/SteveRodrigue/MCD/issues/529))**
  - Removed premature host minion damage assignment from `installInPlay` in `src/engine/simulation/ability-stage-setter.ts`.
  - Replaced ad-hoc minion selection with canonical rules engine candidate resolution via `resolveAttachmentHost` and `attachCardToHost`.
  - Staged attachment cards with no valid host and no fallback are discarded to `encounterDiscard` per RR v1.8 *Attach To*.
