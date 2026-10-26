# [ADR-0020] Optional vs. Forced Trigger Decisions, Exact Event Scoping & Interactive Interrupt State Machine (RR v1.8)

- **Status:** Superseded by [ADR-0032](0032-universal-resolution-stack-decision-prompt-queue-and-nested-interrupts.md)
- **Date:** 2026-08-27
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context & Problem Statement

In Marvel Champions rules architecture, triggers and reactive abilities (Interrupts and Responses) are among the most nuanced systems in the game. Conflating distinct enemy activations or treating optional player choices as automatic side-effects violates official timing rules and breaks tactical decision-making:

1. **Forced vs. Optional Abilities (RR v1.8 p. 20 "Forced", p. 25 "Interrupt", p. 38 "Response"):**
   - **Forced Abilities (`FORCED_INTERRUPT`, `FORCED_RESPONSE`):** Mandatory. The game engine must resolve them immediately and automatically upon their trigger condition without player intervention (e.g. _Nick Fury_ end-of-round discard, villain _When Revealed_ abilities).
   - **Standard Abilities (`INTERRUPT`, `RESPONSE`, `HERO_INTERRUPT`, `HERO_RESPONSE`):** **Strictly optional by player choice**. A player may choose to hold their reactive card or save their resources for a future window. The engine must never automatically spend cards from a player's hand without explicit player confirmation.

2. **Exact Event Scoping (Villain Activations vs. Minion Activations - RR v1.8 p. 39 "Scheme", p. 7 "Attack", p. 47 "Villain Phase"):**
   - Cards such as _Emergency_ (`01085`) specify: _"**Interrupt**: When the villain schemes, reduce the amount of threat placed on the scheme by 1."_
   - **The Villain is NOT a Minion:** Minions are separate enemy entities. When a minion schemes during Step 3 of the Villain Phase, it is a _Minion Activation_, **not** the _Villain Scheming_. Conflating minion threat with villain scheming creates false trigger windows.

3. **Form Invariance of Neutral Interrupts (RR v1.8 p. 21 "Form", p. 25 "Interrupt"):**
   - Cards with neutral `"timing": "INTERRUPT"` (like _Emergency_) lack the `"Hero"` or `"Alter-Ego"` prefix.
   - A player in **Hero form** or **Alter-Ego form** is legally permitted to trigger _Emergency_ whenever the villain schemes (e.g. against another teammate in Alter-Ego form or via treachery cards that cause the villain to scheme).

---

## Decision Drivers

> [!NOTE]
> This section was not part of the original decision record and is not required for this ADR.

---

## Considered Options

> [!NOTE]
> This section was not part of the original decision record and is not required for this ADR.

---

## Decision Outcome

We establish the **Trigger Classification & Interactive Interrupt Architecture**:

### 1. Granular Trigger Types (`TriggerType`)

We split broad event triggers into precise, distinct types:

- `'VILLAIN_SCHEMES'`: Fires when the main villain executes a Scheme activation (Step 2 of Villain Phase or via encounter card effect).
- `'MINION_SCHEMES'`: Fires when an engaged minion executes a Scheme activation (Step 3 of Villain Phase).
- `'VILLAIN_INITIATES_ATTACK'` / `'VILLAIN_ATTACKS'`: Fires when the villain executes an Attack activation.
- `'MINION_ATTACKS'`: Fires when an engaged minion executes an Attack activation.
- `'THREAT_WOULD_BE_PLACED'`: Generic threat placement from side schemes, attachments, or main scheme acceleration.

### 2. Mandatory vs. Optional Trigger Resolution

- **Forced Triggers:** Evaluated and resolved synchronously by `dispatchTrigger`.
- **Optional Triggers:**
  - When an optional interrupt trigger occurs, the engine pauses and populates `state.pendingInterruptPrompt`.
  - The UI renders an interactive **Pop-Art Decision Modal** asking the player whether to trigger the interrupt (e.g. _"Play Emergency to reduce threat by 1?"_).
  - If the player accepts $\rightarrow$ `RESOLVE_INTERRUPT_PROMPT` ({ accepted: true }) spends the card, executes the effect, and resumes phase execution.
  - If the player declines $\rightarrow$ `RESOLVE_INTERRUPT_PROMPT` ({ accepted: false }) leaves the card in hand and continues with unmitigated values.

### 3. Headless & Test Compatibility

For test automation and headless simulation, `dispatchTrigger` accepts an optional `acceptOptionalTriggers?: boolean` context parameter, ensuring full test determinism while supporting interactive UI gameplay.

---

## Evaluation of Options

> [!NOTE]
> This section was not part of the original decision record and is not required for this ADR.

---

## Consequences

- **Rules Reference v1.8 Compliance:** 100% adherence to official timing rules for forced vs optional abilities and enemy activation scoping.
- **Player Agency:** Players retain full strategic control over when to spend defensive/reactive cards from hand.
- **Extensibility:** All future Interrupts and Responses (defense cards, encounter card cancellations like _Enhanced Spider-Sense_, treachery cancels) integrate seamlessly into this prompt architecture.

---

## Addendum (2026-10-04, core review A2): one shared in-hand reaction scan

The three in-hand scans in `dispatchTrigger` (damage about to be taken, threat about to be placed, encounter card revealed) had grown apart: only the encounter path paid the ability cost when it resolved at once, the damage path ran only effects containing `PREVENT_DAMAGE`, and the form and filter checks differed. A fourth hand reaction (`ATTACK_DEFENDED`, Counter-Punch `01077`) had no scan at all, so the card never fired from the hand.

**Decision:** a single `scanHandReactions` helper in `trigger-dispatcher.ts` owns what every hand reaction shares: pick the first hand card per scanned player whose `zone: HAND` ability matches the trigger, the player's form, `canPayAbilityCost` and `triggerFilter`; then either resolve at once (`FORCED_` timing or `acceptOptionalTriggers`: pay the cost, move the card to the discard unless `discardSelf: false`, run the effect) or queue the optional prompt (`requiresPayment` only when the cost is above 0). Per-trigger behaviour is passed in as callbacks (damage prevention, threat reduction, encounter cancellation, prompt display fields). The scan scope is explicit per trigger: threat and `ATTACK_DEFENDED` scan every player (the card's own `triggerFilter` decides who qualifies); damage and encounter reveals scan the targeted player only, because their "you" cards carry no filter.

`ATTACK_DEFENDED` is dispatched with `defenderType` (`HERO` or `ALLY`) and `targetInstanceId` set to the attacking enemy, so cards can say "your hero defends" (`triggerFilter.defenderType`) and "that enemy" (`TRIGGERING_ENEMY`).

---

## Addendum (2026-10-05, #240): "the villain schemes" is scoped by the placement source

Emergency `01085` ("When the villain schemes, reduce the amount of threat placed on the scheme by 1") was offered for every threat placement. **Decision:** no separate trigger. `applyThreatPlacement` passes its `sourceType` as `threatSource` in the `THREAT_WOULD_BE_PLACED` context, and `TriggerFilter.threatSource` scopes a card to a source (Emergency: `VILLAIN_SCHEME`). Cards that say "any threat" (Great Responsibility, "I Object!") carry no filter.

Setup: opening hands are drawn after the scenario setup (Appendix II step 14), and while `setupState.stage` is `SCENARIO_SETUP` (the whole of `setupGame`) `dispatchTrigger` skips player-controlled abilities (hand reactions, identity, tableau and allies); encounter-side abilities still resolve.

---

## Addendum (2026-10-05, #266): a threat placement waits for its interrupt prompts

`applyThreatPlacement` placed the threat as soon as `THREAT_WOULD_BE_PLACED` was dispatched, even when interrupt prompts were queued, and an accepted prompt ran with a snapshot of the amount, so Emergency, Great Responsibility and "I Object!" accepted from their prompt changed nothing.

**Decision:** when the window enqueues prompts, the placement is stored in `state.pendingThreatPlacements` (`{ id, request, amount }`) and every option of those prompts carries the `threatPlacementId` in its context. Accepting an option runs the ability with the live amount and writes the reduced amount back, so later interrupts (any player) see it. When the prompt queue is empty the paused placements are placed in order (`finishPendingThreatPlacements`), then paused sequences resume (#248). A pending amount of 0 (a replacement such as Great Responsibility, or reductions that use the threat up) closes the window: the remaining prompts for that placement are removed and nothing is paid. A queued prompt is shown only while its card is still in hand, its cost is payable and its limit is unused. For this trigger the hand scan offers every eligible card of each player (copies included), starting with the first player; the other hand triggers keep one card per player (#267). The stepped villain phase updates its step event with the final amount.

---

## Addendum (2026-10-12, #267): Hand reactions offer all eligible cards in first-player turn order and damage placements wait for interrupt prompts

Prior to #267, non-threat in-hand triggers (`DAMAGE_WOULD_BE_TAKEN`, `ENCOUNTER_CARD_REVEALED`, `TREACHERY_REVEALED`, `ATTACK_DEFENDED`, and `BASIC_ATTACK_PERFORMED`) broke early after finding the first eligible card for each player, preventing multiple copies (e.g. two _Backflips_ or two _Enhanced Spider-Sense_) from being offered. In addition, multiplayer scoping either scanned players out of turn order or unconditionally restricted `DAMAGE_WOULD_BE_TAKEN` to the attacked player even when a reaction had broad scope.

**Decision:**

1. **Full Hand Scanning (`allEligibleCards: true`):** All in-hand triggers offer every eligible card in a player's hand (including duplicate copies) across the response/interrupt window.
2. **Turn-Order Evaluation (`playersInTurnOrder`):** In multiplayer, reactive windows scan players starting from the first player (`playersInTurnOrder(state)`) per RR v1.8 First Player.
3. **Target Scope Resolution:** `DAMAGE_WOULD_BE_TAKEN` defaults to the targeted player for cards without explicit scope filters, while allowing cards with `targetPlayerScope: 'ANY'` to react to damage dealt to any player.
4. **Pending Damage Placements (`pendingDamagePlacements`):** Symmetrical to threat placements (#266, Option B), when the damage pipeline (`resolveDamage`, step 3, after Tough; #389) enqueues damage interrupt prompts for an identity, it stops the occurrence and creates a `PendingDamagePlacement` in `state.pendingDamagePlacements` (`{ id, targetPlayerId, sourceType, amount, initialAmount, attackId, resume }`; `resume` is plain data, see ADR-0078) and tags prompt options with `damagePlacementId`. The window opens for the damage of the attack to the hero and, separately, for the Overkill excess to the controller of a defeated ally.
5. **Live Damage Reduction & Prompt Pruning:** Resolving a damage prevention interrupt updates both `pendingDamagePlacement.amount` and `activeAttackContext.pendingDamage`. If damage reaches 0 or a card is no longer payable/usable, moot queued prompts are pruned (`pruneDamageInterruptPrompts`). Once the prompt queue empties, `finishPendingDamagePlacements` resumes the damage through `resumeDamage` (places the live amount, announces the defeats) and finishes combat resolution.

---

## Addendum: defeat triggers, one occurrence (#342)

RR v1.8 (Triggering Condition): one game occurrence that creates several triggering conditions has a single interrupt window and a single response window. One attack with Overkill can defeat a minion and a villain stage.

- A defeat is announced (`dispatchDefeat`, `triggers/defeat-dispatch.ts`) after the damage pipeline has applied every state change of the occurrence, Overkill included, so a Forced Response sees the final board. This holds for all four target kinds (#359): a minion or ally is already in its discard pile, a villain stage already replaced by the next one (or the game already won), a hero already eliminated. Interrupts to the defeat (`processHostDefeated`) still run first.
- `DEFEATED` and `CHARACTER_DEFEATED` scan the in-play cards and the hand of every player in turn order, and the trigger filter decides. "After you defeat" (`defeatedByAttackOf: YOUR_HERO`) belongs to the player whose hero attacked (RR v1.8 glossary Y), not to the player the minion was engaged with.
- When the last villain stage is defeated, `endGame` sets the winner and clears every pending resolution state, and `dispatchTrigger` returns at once for a finished game: nothing fires after the victory.
- The enemy attack path (`applyCalculatedAttackDamage` in `combat-pipeline.ts`) applies its damage through `applyDamageToTarget` (#269, #360). The pipeline collects the defeats of one occurrence (the ally, then the identity by Overkill; the minion, then the villain) and announces them in that order after the last state change. A side scheme defeat uses the same `dispatchDefeat` (#359).

## Addendum (2026-10-25, #363): Defeat abilities default to their controller

`DEFEATED` and `CHARACTER_DEFEATED` scan every player (the defeater is not the engaged player, #342), but a defeat ability with no scope of its own now reacts only to defeats of its controller's characters, the same default as `DAMAGE_WOULD_BE_TAKEN`. "Your ally" is never another player's ally (the you/your rule).

**Decision:**

1. **One implicit controller scope:** `failsImplicitControllerScope` in `trigger-dispatcher.ts` applies to `DAMAGE_WOULD_BE_TAKEN`, `DEFEATED` and `CHARACTER_DEFEATED` when the filter has no `targetPlayerScope`.
2. **Opt out:** `targetPlayerScope: 'ANY'` reacts to any player's defeat; `OTHER` is unchanged.
3. **Already scoped abilities keep their meaning:** a defeat ability with `defeatedByAttackOf` (who defeated) or `targetScope` (which card) is not given the implicit scope.
4. **Highway Robbery 01166** resolves its own defeat through `defeatSideScheme`, not the player scan, so it cannot double fire (`tests/engine/highway-robbery.test.ts`).
