---
type: Changed
---

- **Refactor (Engine): Action Handler Registry & 400-Line Function Ceiling (`AUD-20261017-232534` R6, ADR-0086)**
  - Extracted the 3,024-line `dispatchSingleAction` switch in `src/engine/pipeline/action-dispatcher.ts` into a typed `ACTION_HANDLERS` registry (`satisfies ActionHandlerMap`) across six family modules under `src/engine/pipeline/actions/` (`setup.ts`, `combat.ts`, `play.ts`, `abilities.ts`, `prompts.ts`, `phase.ts`), merging duplicate chosen-host attachment and prompt-resolution blocks (~310 duplicate lines removed).
  - Decomposed the remaining six >400-line engine functions (`resolveTargets`, `dispatchTrigger`, `handleSearch`, `executeDiscard`, `applyDamageToTarget`, `evaluateDynamicAmount`) into focused helpers and enforced `'max-lines-per-function': ['error', { max: 400 }]` across `src/engine/**/*.ts` in `eslint.config.js`.
  - Added `tests/engine/action-dispatch-registry.test.ts` (18 tests) and recorded ADR-0086 (`docs/decisions/0086-action-handler-registry.md`).

