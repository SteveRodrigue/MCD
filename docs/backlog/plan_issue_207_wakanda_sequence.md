# Plan: Issue #207 — Wakanda Forever! sequence must pause for mid-sequence prompts

> Status: **Implemented (uncommitted)**, 2026-10-04. All five decisions approved as recommended; #225 filed for decision 3.
> Roadmap: `teamwork_status_and_next_target.md`, Phase 5, Track A, step 4. Includes tracker follow-up F1 (`plan_core_player_cards_review.md`).
> Tier 2 (small state addition plus a handler hook; no change to supplemental card data). UI / Card Editor impact: none.

## 1. Rules

RR v1.8 p. 28 / ADR-0038: Wakanda Forever! resolves each Black Panther upgrade's **Special** as one ordered step, in the order the player chose; the last step gets its boosted Finisher bonus. Each step is fully resolved before the next one starts, so a step that needs a decision (Energy Daggers: "choose a player" in multiplayer) must complete that decision before any later step runs.

## 2. Verified defect (reproduced)

`wakandaForeverSpecialHandler.execute` (`src/engine/specials/wakanda-forever.ts`) resolves the ordered upgrades in a synchronous `for` loop. `resolveSingleWakandaUpgrade` returns `void`, so when a step enqueues a prompt the loop does not notice and keeps going; the prompting step's effect lands later, when the player answers.

Reproduced by `tests/engine/wakanda-forever-prompt-order.test.ts` (2 of 4 red):

| Scenario | Expected | Today |
|---|---|---|
| Daggers, then Claws, villain with Tough | Daggers removes Tough, Claws finisher deals 4 | Claws resolves first (strips Tough, 0 damage), Daggers then deals 1: total 1 |
| Claws, Daggers, Tactical Genius, main scheme threat 5 | after the prompt only Claws has resolved (threat still 5) | Tactical Genius already removed threat (3) before the prompt was answered |
| Prompt-free sequence, no leftover state | resolves at once | green (unchanged) |
| Completion leaves no pending state and no prompt | clean | green (vacuously) |

Also verified for F1: all four upgrades (`01046`-`01049`) now declare a `SPECIAL` ability in `core.json`, so the card-coded fallbacks for `01047`, `01048` and `01049` inside `resolveSingleWakandaUpgrade` are unreachable dead code.

## 3. Design (generic, no card-specific engine names)

- **State:** `GameState.pendingSpecialSequence?: { specialId: string; playerId: string; remainingUpgradeIds: string[]; targetEnemyId?: string; targetSchemeId?: string }`: what is still to resolve, in order. Absent when nothing is pending.
- **Handler contract:** `SpecialAbilityHandler` gains an optional `resume(state, context): EffectResult`.
- **Wakanda handler:** `execute` records the ordered upgrades in `pendingSpecialSequence` and calls its resume logic. The resume logic takes the next upgrade, resolves it (`isFinal` is true for the last remaining one), and after each step checks whether that step enqueued a decision prompt (prompt queue longer than before). If so it saves the remainder and returns; otherwise it continues, and when the list is empty it clears the pending state.
- **Resume trigger:** `dispatchAction` is wrapped so that after any successful action, if `pendingSpecialSequence` exists and the prompt queue is empty, the matching special handler's `resume` runs. No change to the many individual prompt-resolution branches.
- **F1:** delete the dead `01047`-`01049` card-coded branches (and the now-unneeded `getEffectiveMaxHealth`/`defeatSideScheme` imports if unused).
- **Not changed:** the order-selection prompt, the single-upgrade path (resolves immediately as the finisher), supplemental data.

## 4. Files

| Tag | File | Change |
|---|---|---|
| MODIFY | `src/engine/models/state.ts` | `PendingSpecialSequence`, `GameState.pendingSpecialSequence` |
| MODIFY | `src/engine/specials/special-registry.ts` | optional `resume` on the handler |
| MODIFY | `src/engine/specials/wakanda-forever.ts` | pending-sequence loop with pause/resume; remove dead fallbacks (F1) |
| MODIFY | `src/engine/pipeline/action-dispatcher.ts` | wrap `dispatchAction` to resume a pending special sequence |
| NEW | `tests/engine/wakanda-forever-prompt-order.test.ts` | 4 tests (2 red now) |
| MODIFY | `docs/specifications/supplemental/02_timings_and_triggers.md`, ADR-0038 addendum | resume semantics |
| MODIFY | `CHANGELOG.md`, backlog, tracker docs | status; mark F1 and #207 done |

## 5. TDD

1. **Red (done):** the two failing scenarios above.
2. **Green:** state, hook, handler loop, dispatcher wrapper.
3. **Regression:** existing `wakanda-forever-sequence.test.ts` (7 tests) and `energy-daggers-chosen-player.test.ts` unchanged and green; full suite (baseline 1,701), `typecheck`, `lint`, `format:check`.
4. **Extra:** a prompt answered while another unrelated prompt is still queued does not resume early; a game with no pending sequence is unaffected (wrapper no-op).

## 6. Decisions needed

1. **Approach:** resumable sequence with `pendingSpecialSequence` (recommended: correct for any order-dependent interaction such as Tough or defeat), vs pre-collecting choices before the sequence runs (smaller, but wrong when a choice depends on earlier steps).
2. **Resume hook:** wrap `dispatchAction` (recommended, one place) vs add the resume call to each prompt-resolution branch.
3. **Step failures stay swallowed:** `executeSequence` reports overall success even when a step fails, for every ability in the game, not just this special. Recommended: leave it out of #207 and file a separate issue for failure propagation in `executeSequence`.
4. **Event discard timing:** Wakanda Forever! is discarded when played even if the sequence pauses on a prompt. Recommended: leave as is (the card has already been played; only effect timing is deferred).
5. **F1:** remove the dead card-coded fallbacks in the same change (recommended).

## 7. Estimate

About 2 hours: 1 h engine and wrapper, 30 min tests, 30 min docs. One commit: `fix(engine): Pause the Wakanda Forever! sequence for mid-sequence prompts (Fixes #207)`.
