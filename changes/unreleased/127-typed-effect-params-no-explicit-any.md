---
type: Changed
---

- **Refactor (Engine): Typed effect parameters and `no-explicit-any` across `src/engine/` ([Issue #127](https://github.com/SteveRodrigue/MCD/issues/127), AUD-20261017-232534 R5)**
  - Derived `EffectParamsMap` directly from `EFFECT_PARAM_SCHEMAS` in `src/data/supplemental/effect-params.ts` and typed `getStepEffectParams<E>` in `src/data/supplemental/runtime.ts`.
  - Parameterized `StepHandler<E>` and `StepHandlerMap` across all 7 effect handler families (`src/engine/effects/handlers/`).
  - Eliminated all 243 explicit `any` occurrences across `src/engine/**/*.ts` (`handlers`, `effects`, `filters`, `pipeline`, `models`, `queries`, `specials`, `state`, `triggers`) and enforced `@typescript-eslint/no-explicit-any: 'error'` on `src/engine/**/*.ts` in `eslint.config.js`.

