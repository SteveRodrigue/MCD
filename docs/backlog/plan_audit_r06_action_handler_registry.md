# Plan R6: Split the engine god functions (action handler registry)

> **Status:** Proposed, waiting for owner approval.
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R6): F010-A acceptance "no engine function over 400 lines"; architecture move M4.
> **Gate:** Tech Debt & Tooling. **Tier:** 2. **Estimate:** 2–3 days.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## Problem

Measured at `f6e470f` (`logs/reports/code-audit/_work-AUD-20261017-232534/fn-size.ts`, local):

| Function               | File                                            | Lines | Branches |
| ---------------------- | ----------------------------------------------- | ----- | -------- |
| `dispatchSingleAction` | `src/engine/pipeline/action-dispatcher.ts:309`  | 3,000 | 599      |
| `resolveTargets`       | `src/engine/effects/target-resolver.ts:174`     | 1,132 | 258      |
| `dispatchTrigger`      | `src/engine/triggers/trigger-dispatcher.ts:615` | 754   | 202      |
| `handleSearch`         | `src/engine/effects/handlers/cards.ts:608`      | 443   | 122      |
| `executeDiscard`       | `src/engine/effects/index.ts:1741`              | 419   | 65       |
| `applyDamageToTarget`  | `src/engine/pipeline/damage-pipeline.ts:241`    | 408   | 68       |

`dispatchSingleAction` is one `switch (action.type)` over every `GameAction`; it is the same shape `executeStep` had before ADR-0085.

## Rules / spec analysis

Not a rules change; every case body moves as is. Behaviour proof: the full engine suite and `npm run simulate` (100/100, same seed → same final state, ADR-0081).

## Simplification & Refactor Check

- **Reuse ADR-0085's pattern** for actions: `ACTION_HANDLERS satisfies { [T in GameAction['type']]: ActionHandler<T> }`, one module per action family under `src/engine/pipeline/actions/` (play, attack/thwart, abilities, prompts, phase/turn, setup/mulligan). `dispatchSingleAction` keeps its preamble (clone, validation) and dispatches.
- **`resolveTargets`:** split by target kind (one resolver per `TargetType`) behind the same registry idea; read the function first, the split may be smaller.
- **`dispatchTrigger`:** extract the per-step parts (collect, order, prompt, resolve) as named functions; no registry.
- **Reuse the extraction tooling** from F010-A (comment carry-over, import pruning, helper exports; see ADR-0085 Consequences for the load-order caveat: the registry import goes **after** all other imports).
- The 1,000+ line UI components (`CardPaymentModal`, `HeroZone`) are out of scope; they belong to R8.

## File changes

| File                                                                | Change                                           |
| ------------------------------------------------------------------- | ------------------------------------------------ |
| `src/engine/pipeline/action-dispatcher.ts`                          | Dispatch through `ACTION_HANDLERS`               |
| `src/engine/pipeline/actions/*.ts` (new)                            | Family modules                                   |
| `src/engine/effects/target-resolver.ts`                             | Split by target kind                             |
| `src/engine/triggers/trigger-dispatcher.ts`                         | Named step functions                             |
| `tools/audit/schema-engine-coverage.ts`                             | Read action registry keys if it scans the switch |
| `docs/decisions/0086-action-handler-registry.md` (new) + README row | ADR                                              |

## Tests

- No new behaviour. Add `tests/engine/action-dispatch-registry.test.ts`: every `GameAction['type']` has a handler; an unknown type throws (mirror `execute-step-dispatch.test.ts`).
- Run the engine project and `rtk npm run simulate`; compare the summary with the previous run.

## Open decisions

1. One commit per function (recommended) or one for the dispatcher and one for the rest.

## UI and Card Editor impact

None.

## Commits

`refactor(engine): Dispatch game actions through a handler registry`, then one per remaining function, each with `Refs AUD-20261017-232534 R6`.
