# Plan: Remove unchecked casts at the typed effect-handler boundary (R5 follow-up, finding 7)

Status: **implemented, uncommitted**. Decisions: 1A (guards; discriminated union tracked in #326), 2A (runtime-params type), 3A (lint guard). Issue: Refs #127. Source: `/code-review` finding 7 on the R5 diff.

## Problem

R5 typed `EffectParamsMap` and `StepHandler<E>`, but four escape hatches defeat it:

1. `EFFECT_HANDLERS[step.effect] as StepHandler | undefined` (`effects/index.ts:2204`) widens every handler back to the generic type.
2. `step as TypedStep<'X'>` asserts the effect without checking it (`effects/index.ts:1756`, `legality-checker.ts` x3, `stat-calculator.ts` x12).
3. `step.effectParams as Record<string, unknown>` in 13 handler spots, reading keys the strict Zod schemas do not declare.
4. `getStepEffectParams` conditional return type still yields `Record<string, any>` for un-parameterized callers (`data/supplemental/runtime.ts:95`).

## Rules / spec analysis

No gameplay rule changes. Pure typing and dead-key cleanup. Behavior must stay identical.

## Evidence on the undeclared keys

Checked against `src/data/supplemental/*.json` and engine writers:

| Key                                                                                              | In card data     | Written by engine              | Verdict                                                                |
| ------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `piercing`, `preventAll`, `baseAmount`, `amountPerPlayer`, `promptDescription`                   | 0                | 0                              | Dead reads. Delete.                                                    |
| `targetInstanceId`                                                                               | 0                | yes (`executeStep` injects it) | Runtime-only. Move to a typed runtime-params type, not the Zod schema. |
| `isAttack`, `canCancel`, `budgetLabel`, `exactMatchRequired`, `unitSingular`, `unitPlural`       | 0                | 1-13 internal                  | Engine-internal. Move to typed runtime-params.                         |
| `promptTitle`                                                                                    | 1 file           | 0                              | Real data key. Add to the schema for the effects that use it.          |
| `ignoresCrisis`, `playerId`, `targetPlayerId`, `status`, `filter`, `keyword`, `amount`, `target` | check per effect | -                              | Verify each against its effect schema in step 1; declare or delete.    |

## Simplification & Refactor Check

- **Deleted:** the 13 `rawParams`/`rawStepParams` casts, the 5 dead-key reads, the 15 `step as TypedStep<'X'>` assertions, and the `as StepHandler` cast.
- **Merged:** the `EffectType extends E ? any : ...` conditional return in `getStepEffectParams` collapses to one signature, `getStepEffectParams<E>(step: TypedStep<E>): EffectParamsMap[E]`.
- **Added (one):** `EffectRuntimeParamsMap`, a per-effect type for engine-injected keys, intersected into `TypedStep<E>.effectParams`. No parallel path.

## Design

1. **Dispatch without a cast.** Add `dispatchStep(state, step, ctx, player)` in `effects/handlers/index.ts` that does `switch (step.effect)` over a generic helper `run<E>(step as TypedStep<E>)` only after narrowing. Simplest form: make `AbilityStep` a discriminated union `{ [E in EffectType]: TypedStep<E> }[EffectType]` so `EFFECT_HANDLERS[step.effect](...)` type-checks via a single mapped call helper. Decision needed (see below).
2. **Narrow, do not assert.** Add `isStep<E>(step, effect: E): step is TypedStep<E>` and use it in stat-calculator and legality-checker where the code already compares `step.effect === 'X'`. TypeScript then narrows and the 15 casts disappear.
3. **Declare or delete each key** per the table. Runtime keys go in `EffectRuntimeParamsMap`; data keys go in the Zod schema (`effect-params.ts`).
4. **Tighten `getStepEffectParams`** to the single signature above. Callers with a generic `AbilityStep` use `isStep` first.
5. **Lint guard.** Add `no-restricted-syntax` for `as TypedStep<` and `as StepHandler` in `src/engine/` so the casts cannot return.

## File changes

- `src/data/supplemental/runtime.ts`, `effect-params.ts` (promptTitle, any declared keys)
- `src/engine/effects/handlers/types.ts` (`EffectRuntimeParamsMap`, `isStep`)
- `src/engine/effects/handlers/{cards,choice,damage,encounter,resources,state}.ts` (drop `rawParams`)
- `src/engine/effects/index.ts`, `src/engine/pipeline/{legality-checker,stat-calculator}.ts`, `src/engine/models/keyword-helpers.ts`
- `eslint.config.js` (guard rule)
- `docs/decisions/0085-effect-step-handler-registry.md` (note the dispatch contract)
- `changes/unreleased/` fragment

## Tests

- Extend `tests/engine/effect-params-types.test.ts`: type-level checks that `getStepEffectParams<'X'>` rejects keys outside the schema, and that `isStep` narrows.
- Run `rtk npx vitest related <changed files> --run`, plus `rtk npx tsc --noEmit` and lint. Existing 2051 related tests must stay green with no edits to expectations.
- Data check: `rtk npm run report:declarations` must show no change (no card data edited except possibly `promptTitle` schema declaration).

## UI / Card Editor impact

Card Editor reads `EFFECT_PARAM_SCHEMAS`. Declaring `promptTitle` adds one editor field for the effects that use it. No other editor change. No UI change.

## Risks

- The data key audit could find a key used by a card the grep missed (YAML, TS fixtures). Mitigation: run full `npm test` before push; the strict schema already rejects unknown keys at load time.
- Discriminated-union `AbilityStep` may ripple into many type sites. Fallback: keep `AbilityStep` as is and use `isStep` only.

## Estimate

About 2 hours: 30 min key audit, 60 min casts and types, 30 min tests and lint rule.

## Open decisions

1. Dispatch style: discriminated-union `AbilityStep` (stronger, wider ripple) or `isStep` guards only (smaller, still removes all casts)? Recommendation: guards only.
2. Engine-internal keys (`isAttack`, `canCancel`, ...): runtime-params type (recommended) or declare them in the Zod schema (exposes them to card authors and the editor)?
3. Add the lint guard against the casts? Recommendation: yes.
