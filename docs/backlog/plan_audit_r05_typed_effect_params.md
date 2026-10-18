# Plan R5: Typed effect parameters and `no-explicit-any` per engine folder

> **Status:** Proposed, waiting for owner approval.
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R5): F010-A rest (typed params), F021 rest (`no-explicit-any`). Same scope as issue [#127](https://github.com/SteveRodrigue/MCD/issues/127) (Tech Debt); commits use `Refs #127`.
> **Gate:** Tech Debt & Tooling. **Tier:** 2. **Estimate:** 2–3 days, delivered in slices (one commit per folder).
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Problem

- Effect handlers (ADR-0085, `src/engine/effects/handlers/`) read `getStepEffectParams(step)` as `Record<string, any>`; `effectParams` is read at about 282 sites in `src/engine`. `src/data/supplemental/effect-params.ts` already declares the parameter keys per effect, but the handlers do not use those types.
- `@typescript-eslint/no-explicit-any` is `off` (`eslint.config.*:37`). Count at `f6e470f`: 362 `any` in `src`, 1,730 repo-wide (tests included). Turning it on as `warn` repo-wide would fail `--max-warnings 0`.

## Rules / spec analysis

Not a rules change. ADR-0080 (Zod-free runtime module, F014-A addendum) and ADR-0085 (handler registry) are the contracts. `docs/coding_guidelines.md`: `unknown` plus type guards for runtime-unknown values.

## Simplification & Refactor Check

- **Derive, do not duplicate:** an `EffectParamsMap` type (`{ [E in EffectType]: … }`) built from the existing `effect-params.ts` declarations, and a generic `getStepEffectParams<E>(step: AbilityStep & { effect: E }): EffectParamsMap[E]`. No second list of keys.
- **Handler signature:** `StepHandler<E>` receives typed params; `EFFECT_HANDLERS` keeps `satisfies Record<EffectType, StepHandler>`.
- **Delete** `as any` casts that the typed params make unnecessary; normalise legacy inputs at one named boundary (issue #127, step 2).
- **Lint ratchet:** enable `no-explicit-any: 'error'` per folder via `overrides`, starting with `src/engine/effects/handlers/**`, then `src/engine/effects/**`, `src/engine/filters/**`, `src/engine/pipeline/**`. Tests stay `off` (fixtures cast on purpose).
- Overlaps issue #285 (reverse guard for effect parameters): read it first and reuse its key inventory if done.

## File changes

| File                                                                                    | Change                                         |
| --------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `src/data/supplemental/effect-params.ts`, `runtime.ts`                                  | `EffectParamsMap`, typed `getStepEffectParams` |
| `src/engine/effects/handlers/*.ts`, `types.ts`                                          | Typed handler params, casts removed            |
| `src/engine/effects/index.ts`, `dynamic-formula-evaluator.ts`, `filters/card-filter.ts` | `any` → typed or `unknown` + guard             |
| `eslint.config.*`                                                                       | Per-folder `no-explicit-any: 'error'`          |
| `docs/decisions/0085-effect-step-handler-registry.md`                                   | Consequences: params now typed                 |

## Tests

- Typecheck is the main test. Add `tests/engine/effect-params-types.test.ts` with `expectTypeOf` for two effects (one with required, one with optional params).
- Run `rtk npx vitest related <changed files> --run` per slice; behaviour must not change.

## Open decisions

1. Folder order for the lint ratchet (proposed above).
2. Close #127 when the four engine folders enforce the rule, or keep it open for `src/ui`.

## UI and Card Editor impact

None at runtime. The Card Editor reads the schema, not these types.

## Commits

One per slice: `refactor(engine): Type effect parameters in <family> handlers` with `Refs #127, AUD-20261017-232534 R5`.
