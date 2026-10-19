# [ADR-0086] Action Handler Registry and 400-Line Engine Function Ceiling

- **Status:** Accepted
- **Date:** 2026-10-19
- **Authors:** MCD Core Team
- **Deciders:** Owner & Claude
- **Related Issues:** Code audit AUD-20261017-232534, finding F010-B (Plan R6)

---

## Context and Problem Statement

Following the step handler registry in [ADR-0085](0085-effect-step-handler-registry.md), `dispatchSingleAction` in `src/engine/pipeline/action-dispatcher.ts` was the largest remaining god function in the engine: 3,331 lines in a single switch block over `action.type` (24 cases). Adding or updating an action meant editing a monolithic file with high merge conflict risk and no compile-time enforcement of action coverage.

Additionally, seven functions across the engine exceeded 400 lines (`dispatchSingleAction`, `resolveTargets`, `dispatchTrigger`, `handleSearch`, `executeDiscard`, `applyDamageToTarget`, and `evaluateDynamicAmount`), making them hard to audit and maintain.

## Decision Drivers

- Compile-time proof that every `GameAction['type']` has an action handler via TypeScript `satisfies`.
- Modularize actions by semantic domain into focused, cohesive modules.
- Enforce an automated 400-line maximum per function across all of `src/engine/**/*.ts` via ESLint.
- Disallow type-unsafe assertions (`as ActionHandler`) outside the single registry runner.
- Zero behavioral changes: 100% preservation of rules engine semantics.

## Considered Options

1. **Typed handler registry by action family + 400-line ceiling (chosen).**
2. Extract case bodies into local functions within `action-dispatcher.ts` while keeping the switch.
3. Keep `action-dispatcher.ts` as a switch and only extract helpers in the other six functions.

## Decision Outcome

**Chosen option 1.**

### 1. Action Handler Registry (`src/engine/pipeline/actions/`)
`dispatchSingleAction` is decomposed into a typed handler registry pattern:
- `types.ts`: Defines `TypedAction<T>`, `ActionHandler<T>`, and `ActionHandlerMap`.
- `setup.ts`: Setup and developer actions (`RESOLVE_MULLIGAN`, `DEV_ADD_CARD_TO_HAND`).
- `combat.ts`: Combat and thwart actions (`BASIC_ATTACK`, `ALLY_ATTACK`, `BASIC_THWART`, `ALLY_THWART`, `DECLARE_DEFENDER`).
- `play.ts`: Card playing actions (`PLAY_CARD`, with internal helpers for upgrades, supports, allies, events, and side schemes).
- `abilities.ts`: Identity and tableau abilities (`CHANGE_FORM`, `BASIC_RECOVER`, `USE_CARD_ABILITY`).
- `prompts.ts`: Decision prompts (`RESOLVE_DECISION_PROMPT`, with helpers for modal choice resolution, distribution, attachments, search, and ordering).
- `phase.ts`: Phase transitions (`PASS_TURN`, `END_ROUND`, `ADVANCE_VILLAIN_PHASE`).
- `index.ts`: Merges all handlers into `ACTION_HANDLERS satisfies ActionHandlerMap`, exporting `runActionHandler(nextState, state, action)`.

`action-dispatcher.ts` was reduced from 3,331 lines to ~250 lines, serving as the high-level orchestrator (`dispatchSingleAction` and `dispatchActionSequence`).

### 2. 400-Line Function Ceiling
The six other oversized engine functions were refactored into focused internal helper functions:
- `src/engine/effects/target-resolver.ts`: `resolveTargets` split into 5 group resolvers (`resolveIdentityAndSelfTarget`, `resolvePlayerSelectorTarget`, `resolveFriendlyAndUniversalCharacterTarget`, `resolveEnemyAndMinionTarget`, `resolveSchemeAndContinuityTarget`), preserving all switch case strings for schema coverage audit tools.
- `src/engine/triggers/trigger-dispatcher.ts`: `dispatchTrigger` split into `scanIdentityTriggerAbilities`, `scanInPlayTriggerAbilities`, `scanAllHandTriggerReactions`, `finalizeQueuedTriggerPrompts`, with shared `getAbilityPreventAmount` and `getTriggerSourceFields` helpers.
- `src/engine/effects/handlers/cards.ts`: `handleSearch` split into `collectSearchCandidates`, `routeSearchedCards`, `getSearchZonePile`, and `shuffleSearchedDecks`.
- `src/engine/effects/index.ts`: `executeDiscard` split into `discardFromHand`, `discardFromPlayerDeck`, `discardFromEncounterDeck`, and `discardFromTableau`.
- `src/engine/pipeline/damage-pipeline.ts`: `applyDamageToTarget` split into `applyDamageAndCheckDefeat` and `applyRetaliateDamage`.
- `src/engine/effects/dynamic-formula-evaluator.ts`: `evaluateDynamicAmount` split into `evaluateDiscardedCardsValue`.

### 3. ESLint Quality Gates
`eslint.config.js` was updated with:
- `'max-lines-per-function': ['error', { max: 400, skipBlankLines: false, skipComments: false }]` on `src/engine/**/*.ts`.
- `no-restricted-syntax` restricting `as ActionHandler` to `src/engine/pipeline/actions/index.ts` only.

### Consequences

- Every function across `src/engine/**/*.ts` is strictly under 400 lines.
- Missing action handlers fail at build time via `ACTION_HANDLERS satisfies ActionHandlerMap`.
- `action-dispatcher.ts` and all engine modules remain decoupled and headless.
- 100% of the Vitest test suite and deterministic seed simulations pass without regressions.
