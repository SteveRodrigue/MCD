# Draft GitHub issue: Wakanda Forever! sequence cannot pause for a mid-sequence prompt (steps resolve out of order)

**Title:** `bug(engine): Wakanda Forever! sequence does not pause for mid-sequence decision prompts, so later steps resolve before the prompting step`
**Labels:** `bug`, `subsystem:engine`, `priority:P2-medium`, `impact:medium`
**Refs:** #18 (sequence execution), #19 (Energy Daggers data), core review item A1 (`docs/backlog/plan_core_review_a1_energy_daggers.md`)

## Summary

`wakandaForeverSpecialHandler.execute` (`src/engine/specials/wakanda-forever.ts`) resolves every upgrade's Special step in a synchronous `for` loop via `resolveSingleWakandaUpgrade`, which returns `void` and discards each step's `EffectResult`. If a step enqueues a decision prompt (it returns without applying its effect), the loop does not wait. The following upgrades resolve immediately, and the prompting step's effect is applied later, when the player answers. The rules say each Special is a step in an ordered sequence (RR v1.8 p. 28; ADR-0038), so this breaks that order.

Today only Energy Daggers `01046` can trigger this (multiplayer "choose a player", added in A1). Any future Black Panther upgrade, or card, that needs a mid-sequence choice will hit it.

## Reproduction (verified with a throwaway test, since removed)

2 players. Player 1 controls Energy Daggers + Panther Claws. Player 2 has one engaged minion. The villain has a Tough status card.

1. Play Wakanda Forever!, choose the order `[Energy Daggers, Panther Claws]`.
2. Daggers enqueues "Choose a Player". The loop continues and Panther Claws (final step, 4 damage) resolves immediately.
3. The player then chooses Player 2, and Daggers (1 damage) resolves.

**Expected:** Daggers first removes the villain's Tough, then Claws deals 4 → villain takes **4** damage.
**Actual:** Claws strips Tough (0 damage), then Daggers deals 1 → villain takes **1** damage.

Without Tough the totals happen to match (5), so the existing tests don't catch it.

## Other consequences to consider

- Any order-dependent interaction is wrong, such as Tough removal, defeat before a later step, or Vibranium Suit moving damage before/after other steps.
- `isFinalStep` is decided up front, so the finisher bonus lands on the right step. Only the *timing* of the deferred step is wrong.
- The player may be shown the "Choose a Player" prompt after the sequence has visibly finished.
- Errors from steps are swallowed (`resolveSingleWakandaUpgrade` returns `void`), so a failing step doesn't stop the sequence.

## Proposed direction (needs a design decision, likely Tier 3)

Make the sequence resumable: persist the remaining ordered upgrades (a "pending sequence" on `GameState` or on the prompt), resolve one step at a time, and when a step enqueues a prompt, stop and resume from the next step after the prompt resolves (the same pattern as `activeEncounterContext` resume). Return/propagate each step's `EffectResult` so failures are visible.

Alternative (smaller, but partial): resolve choice-needing steps' prompts *before* running the sequence (pre-collect choices), then run synchronously. This keeps the loop synchronous but needs a "pre-choice" phase in the handler.

## Acceptance criteria

- Failing-first test: the Tough-villain, 2-player, Daggers-then-Claws scenario above yields 4 villain damage.
- Test: Daggers in the middle of 3 upgrades. Steps before it resolve first, steps after it wait for the prompt.
- Test: prompt answered, then the sequence completes with correct finisher placement; no leftover pending-sequence state.
- No behavior change for single-player or prompt-free sequences (existing `wakanda-forever-sequence` tests pass).
- Update `docs/specifications/supplemental/` (`SPECIAL` timing / sequence resolution) with the resume semantics.
