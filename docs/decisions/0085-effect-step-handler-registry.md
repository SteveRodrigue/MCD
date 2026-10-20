# [ADR-0085] Effect Step Handler Registry

- **Status:** Accepted
- **Date:** 2026-10-18
- **Authors:** MCD Core Team
- **Deciders:** Owner & Claude
- **Related Issues:** Code audit AUD-20261017-232534, findings F010 and F014

---

## Context and Problem Statement

`executeStep` in `src/engine/effects/index.ts` resolved every ability step through one `switch (step.effect)` of 56 cases and about 3,450 lines. A new effect meant editing that function; its `default` silently succeeded until F010-C made it throw, and merge conflicts concentrated in one place.

## Decision Drivers

- Compile-time proof that every schema effect has a handler.
- Files small enough to read and review by effect family.
- No behaviour change: every case body moves as is.

## Considered Options

1. **Handler registry by effect family (chosen).**
2. Keep the switch and extract each case body into a named function in the same file.
3. Keep the switch as is (only the fail-fast default from F010-C).

## Decision Outcome

**Chosen option 1.** Each case body is now a handler function `(state, step, context, player) => EffectResult` in one of seven family modules under `src/engine/effects/handlers/` (`cards`, `damage`, `encounter`, `combat`, `state`, `resources`, `choice`). Each module exports a `<FAMILY>_HANDLERS` object; `handlers/index.ts` merges them into `EFFECT_HANDLERS`, which `satisfies Record<EffectType, StepHandler>`, so a missing handler fails the build. `executeStep` keeps its preamble (player, parameter normalization, target choice) and dispatches through the registry.

Adding an effect: add it to `EFFECT_TYPES` (`src/data/supplemental/runtime.ts`, ADR-0080 addendum), write the handler in the family module, add the key to that family's `*_HANDLERS`. The schema audit tools read the registry keys (`tools/audit/schema-engine-coverage.ts`, `schema-member-coverage.ts`).

### Consequences

- `effects/index.ts` fell from 5,687 to about 2,200 lines; the largest family module is about 1,300 lines.
- Handlers import shared helpers from `effects/index.ts`, which imports the registry: a function-level cycle, safe because no module calls into it at load. `effects/index.ts` imports `./handlers` after all its other imports, so pipeline modules that register hooks at load (`combat-pipeline` → `prompt-queue`) keep their initialization order.
  - **Addendum (2026-10-20, ADR-0088):** this import-order dependency is gone. Recursion goes through `kernel.<entry>(...)`, bound at boot, so `effects/index.ts` no longer depends on import order and the load-time hook registration was deleted.
- Effect parameters are now typed per effect via `EffectParamsMap` (`src/data/supplemental/effect-params.ts`), `getStepEffectParams<E>` (`src/data/supplemental/runtime.ts`), and `StepHandler<E>` (`src/engine/effects/handlers/types.ts`).
- `git blame` of the moved bodies starts at this change.
