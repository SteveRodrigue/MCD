# [ADR-0077] Chosen Target vs. Event Target, and Step-Level Target Choice

- **Status:** Accepted
- **Date:** 2026-10-05
- **Deciders:** Owner & Claude
- **Related Issues:** #234 (Daredevil, Interrogation Room, Mockingbird never let the player choose; duplicates #235, #236, #239), #247 (Chase Them Down, out of scope)
- **Refines:** [ADR-0070](0070-systemic-chosen-entity-targeting-and-decision-fallback-architecture.md) (its Layer 2 prompt/auto-bind rule, until now only in `action-dispatcher.ts`)

---

## Context

`EffectExecutionContext.targetInstanceId` / `targetType` carried two meanings:

1. for player actions, the target **the player chose** (the UI picks it before dispatch);
2. for triggered abilities, the target **of the event** (the thwarted scheme, the defeated minion, the attacking enemy).

Every `CHOSEN_*` selector read it as meaning 1. So Daredevil's "deal 1 damage to an enemy" after a thwart resolved against the thwarted scheme, found no enemy, and fell through to "deal damage to the villain"; Interrogation Room's scheme prompt was suppressed because the defeated minion's id looked like a chosen target. Where nothing leaked, the resolver **guessed** (first engaged minion, else the villain). Card data had also come to depend on the leak: Superhuman Strength `01028` ("stun the attacked enemy") used `PREVIOUS_TARGET`, which only worked because the event's target sat in the chosen-target slot.

## Decision

1. **Two fields, one meaning each.** `EffectExecutionContext` has `chosenTargetInstanceId` / `chosenTargetType` and `eventTargetInstanceId` / `eventTargetType`; the old fields are removed (no alias). Trigger paths write only `eventTarget*`; player actions and prompt answers write only `chosenTarget*`. `TriggerContext` keeps `targetInstanceId` / `targetType` (inside an event they can only mean the event's target).
2. **Readers are classified by selector.** `CHOSEN_*`, `PREVIOUS_TARGET`, `PREVIOUS_SELECTED_CARD` and dynamic formulas read the chosen target; `TRIGGERING_*` and the `HOST` fallback read the event target.
3. **One step-level target choice** (`src/engine/effects/target-choice.ts`, called from `executeStep`) for single-target `CHOSEN_*` selectors on every execution path: valid targets per RR v1.8 "Target", computed when the step runs; 0 → the step does nothing, 1 → used, 2+ → a prompt whose options re-run the step with the chosen target. This extends ADR-0070's Layer 2 beyond `action-dispatcher.ts` and replaces `REMOVE_THREAT`'s two hand-written scheme prompts.
4. **Optional stays optional, and initiation needs a valid target** (RR v1.8 "Initiating Abilities"): the Yes/No prompt always comes first; an optional ability with no valid target is not offered; on Yes the check is repeated before the cost is paid. The target prompt is separate from the Yes/No prompt because resolving the Response's own trigger can start a chain that changes the board (owner decision).
5. **No guessing.** The resolver returns nothing for a `CHOSEN_*`, `TRIGGERING_*` or `PREVIOUS_TARGET` selector without a chosen, event or previous target. `TRIGGERING_ENEMY` resolves the villain only when the event names it by type. The unused ad-hoc labels `ATTACK_TARGET`, `ATTACKED_ENEMY`, `TARGET_ENEMY` are removed.

## Consequences

- Seven core cards now resolve as printed: Daredevil `01058`, Interrogation Room `01063`, Mockingbird `01083`, She-Hulk `01019a`, Nick Fury `01084`, Wakanda Forever! (Panther Claws `01047`), Superhuman Strength `01028` (data: `PREVIOUS_TARGET` → `TRIGGERING_ENEMY`).
- A prompt opened in the middle of a plain sequence lets later steps run before the answer; Hulk `01050` (step 2 of 4) waits on resumable sequences (#248). Special sequences already pause (#207); `PendingDecisionPrompt.isFinalStep` carries the finisher flag through the target prompt.
- Tests that relied on a guess now choose their target explicitly; the `main_scheme` option alias is gone (options use instance ids).
