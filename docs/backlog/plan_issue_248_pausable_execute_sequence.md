# Plan: Issue #248 — Resumable `executeSequence` (Pausable Multi-Step Sequences & Hulk 01050)

> **Status:** Implemented (approved with Option A: keep #225 separate)
> **Issue:** [#248](https://github.com/SteveRodrigue/MCD/issues/248)
> **Depends on:** #234 (committed `5d01ec3`)
> **Unblocks:** Hulk `01050` full correctness, general ability sequence pauses across all multi-step cards
> **Tier:** 2 (engine execution lifecycle refactor + retiring bespoke `pendingSpecialSequence`)
> **UI / Card Editor impact:** None (decision prompts and modals already render uniformly; no schema change).

---

## 1. Context & Rules Analysis

### 1.1 The Problem
In Marvel Champions (RR v1.8 *Ability*, *Target*, *Initiating Abilities*), an ability's steps resolve in the exact order written on the card.
When an ability step requires a player decision (e.g., choosing an enemy among multiple valid targets via `chooseStepTarget`, or a modal choice), that step cannot complete until the player makes their selection.

Today, `executeSequence` (`src/engine/effects/index.ts`) executes `steps: AbilityStep[]` in a synchronous `for` loop. When a step enqueues a decision prompt into `state.pendingDecisionQueue`:
1. The prompting step returns `{ state, success: true, mutatedState: true }`.
2. `executeSequence` immediately continues executing subsequent steps in the loop against the current state before the player answers the prompt.
3. Later, when `RESOLVE_DECISION_PROMPT` is dispatched, the prompted step's effect is executed out of order.

Issue #207 previously addressed this specifically for Wakanda Forever! via a bespoke `pendingSpecialSequence` tracker. Plain cards with multi-step sequences (like Hulk `01050`) remained broken.

### 1.2 Impact on Cards (e.g. Hulk `01050`)
- **Hulk `01050` (Ally):**
  > **Forced Response**: After Hulk attacks, discard the top card of your deck. If that card's printed resource has:
  > - [physical] - Deal 2 damage to an enemy.
  > - [energy] - Deal 1 damage to each character.
  > - [mental] - Discard Hulk.
  > - [wild] - All of the above.
- **Defect with wild resource & 2+ enemies:**
  Step 1 discards the wild resource card.
  Step 2 opens a prompt to choose an enemy for the 2 damage.
  Before the player chooses, Step 3 deals 1 damage to all characters and Step 4 discards Hulk.
  Only afterwards is the 2 damage dealt.
- **Expected:** Step 2 prompts and pauses the sequence. The 2 damage is dealt to the chosen enemy first. Then Step 3 deals 1 damage to all characters (which may defeat that enemy), and Step 4 discards Hulk.

---

## 2. Architecture & Design

### 2.1 Unified `PendingSequence` Model
Replace the bespoke `pendingSpecialSequence` with a generic, stack-based `pendingSequences` queue in `GameState`:

```ts
export interface PendingSequence {
  sequenceId?: string;
  remainingSteps: AbilityStep[];
  context: EffectExecutionContext;
  previousResult?: StepResolutionResult;
  stepResultsMap?: Record<string, StepResolutionResult>;
  onomatopoeias?: string[];
  anyStepMutated?: boolean;
}
```

### 2.2 Pausing in `executeSequence`
In `executeSequence` (`src/engine/effects/index.ts`):
1. Record `promptsBefore = currentState.pendingDecisionQueue?.length ?? 0`.
2. Execute step $i$.
3. Check `promptsAfter = currentState.pendingDecisionQueue?.length ?? 0`.
4. If `promptsAfter > promptsBefore` and there are remaining steps ($i + 1 < \text{steps.length}$):
   - Push a `PendingSequence` with `remainingSteps: steps.slice(i + 1)`, preserved `context`, `prevResult`, `stepResultsMap`, `onomatopoeias`, and `anyStepMutated`.
   - Immediately return `{ state: currentState, success: true, mutatedState: anyStepMutated, onomatopoeia: 'SEQUENCE PAUSED (WAITING CHOICE)' }`.

### 2.3 Resuming in `dispatchAction`
In `src/engine/pipeline/action-dispatcher.ts`:
```ts
export function dispatchAction(
  state: GameState,
  action: GameAction,
): { state: GameState; result: ActionResult } {
  const outcome = dispatchSingleAction(state, action);
  if (!outcome.result.success || !outcome.state.pendingSequences?.length || peekDecisionPrompt(outcome.state)) {
    return outcome;
  }
  return { state: resumePendingSequence(outcome.state), result: outcome.result };
}
```

`resumePendingSequence(state)` pops the top `PendingSequence` and resumes `executeSequence` with the remaining steps and restored execution context (including `discardedCards`, `previousResult`, and dynamic values).

### 2.4 Unifying Wakanda Forever!
Retire `pendingSpecialSequence` completely:
`wakandaForeverSpecialHandler.execute` flattens the selected upgrade abilities into a single sequence of `AbilityStep`s where each step specifies its `sourceCardInstance` and `isFinalStep` flag, then delegates directly to `executeSequence`.
No custom resume hook or duplicate sequence management is required for Wakanda Forever!.

### 2.5 Note on Issue #225 (Failure Propagation)
Issue #225 concerns whether `executeSequence` should propagate `success: false` or abort when a step fails. This is an independent semantic change with broader test impact. In accordance with the issue scope, #248 focuses strictly on pause/resume ordering, keeping #225 cleanly separated.

---

## 3. Files to Modify

| Action | File | Description |
| :-- | :-- | :-- |
| **MODIFY** | `src/engine/models/state.ts` | Remove `PendingSpecialSequence`; add `PendingSequence` and `GameState.pendingSequences` |
| **MODIFY** | `src/engine/effects/index.ts` | Implement pausable/resumable `executeSequence`; export `resumePendingSequence`, `pushPendingSequence`, `popPendingSequence`, `hasPendingSequence` |
| **MODIFY** | `src/engine/pipeline/action-dispatcher.ts` | Update `dispatchAction` to resume generic pending sequences |
| **MODIFY** | `src/engine/pipeline/prompt-queue.ts` | Resume pending sequences on prompt completion when prompt queue is empty |
| **MODIFY** | `src/engine/specials/special-registry.ts` | Remove `resume` from `SpecialAbilityHandler` and `resumePendingSpecialSequence` |
| **MODIFY** | `src/engine/specials/wakanda-forever.ts` | Simplify Wakanda Forever handler to execute via `executeSequence` with unified steps |
| **MODIFY** | `tests/engine/wakanda-forever-prompt-order.test.ts` | Update state assertions from `pendingSpecialSequence` to `pendingSequences` |
| **MODIFY** | `tests/engine/nemesis-spawning.test.ts` | Resolve Quickstrike attack prompt during Shadow of the Past sequence resumption |
| **NEW** | `tests/engine/hulk-prompt-order.test.ts` | Comprehensive TDD reproduction and verification for Hulk `01050` pause/resume ordering |
| **MODIFY** | `docs/specifications/supplemental/02_timings_and_triggers.md` | Document resumable sequence lifecycle and prompt queue interaction |
| **MODIFY** | `CHANGELOG.md` | Document #248 fix under `[Unreleased]` |

---

## 4. TDD Test Plan

1. **`tests/engine/hulk-prompt-order.test.ts` (New):**
   - **Scenario 1 (Red first):** Hulk attacks with wild card top of deck and 2 enemies in play (Rhino + Hydra Mercenary).
     - Step 1 discards the wild resource card.
     - Step 2 pauses and prompts for enemy target. Assert Step 3 (all characters damage) and Step 4 (discard Hulk) have not executed (Minion and Hero at initial HP, Hulk in play).
     - Dispatch `RESOLVE_DECISION_PROMPT` choosing Hydra Mercenary.
     - Hydra Mercenary takes 2 damage first, then Step 3 deals 1 damage to all characters (defeating Hydra Mercenary), and Step 4 discards Hulk.
     - Assert `pendingSequences` is undefined/empty at completion.
   - **Scenario 2:** Hulk attacks with physical card top of deck -> Step 2 damages enemy, Steps 3 & 4 skipped by gates, Hulk remains in play.
   - **Scenario 3:** Hulk attacks with single enemy (Rhino only) -> Resolves immediately without prompt or pause.
2. **`tests/engine/wakanda-forever-prompt-order.test.ts`:**
   - Verify all 5 existing Wakanda Forever pause/resume test scenarios remain green under the unified mechanism.

---

## 5. Open Decision

**Decision 1: Scope of #225 (Swallowed step failures)**
- **Option A (Recommended):** Keep #225 separate. Focus #248 exclusively on resumable execution / prompt pausing and retiring `pendingSpecialSequence`.
- **Option B:** Bundle #225 failure propagation into this change (stops sequence on step failure and propagates `success: false`).
- *Rationale for Option A:* Failure propagation has a wide blast radius across existing card tests that check "nothing happened" on invalid inputs; doing it separately prevents conflating pause bugs with failure handling.
