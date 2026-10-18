---
type: Changed
---

- **Change (Engine): Effect steps dispatch through a handler registry (AUD-20261017-232534 F010-A, ADR-0085)**
  - The 56-case `switch (step.effect)` in `executeStep` (about 3,450 lines) is split into handler functions in seven family modules under `src/engine/effects/handlers/`. `EFFECT_HANDLERS` must list every schema effect or the build fails. Behaviour is unchanged: each case body moved as is.
  - `src/engine/effects/index.ts` falls from 5,687 to about 2,200 lines. The schema audit tools read the registry keys instead of `case` labels.
