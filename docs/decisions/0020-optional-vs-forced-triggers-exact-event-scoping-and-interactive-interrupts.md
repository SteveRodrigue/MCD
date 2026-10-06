# [ADR-0020] Optional vs. Forced Trigger Decisions, Exact Event Scoping & Interactive Interrupt State Machine (RR v1.8)

- **Status:** Superseded by [ADR-0032](0032-universal-resolution-stack-decision-prompt-queue-and-nested-interrupts.md)
- **Date:** 2026-08-27
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context & Problem Statement

In Marvel Champions rules architecture, triggers and reactive abilities (Interrupts and Responses) are among the most nuanced systems in the game. Conflating distinct enemy activations or treating optional player choices as automatic side-effects violates official timing rules and breaks tactical decision-making:

1. **Forced vs. Optional Abilities (RR v1.8 p. 11 "Forced", p. 12 "Interrupt", p. 19 "Response"):**
   - **Forced Abilities (`FORCED_INTERRUPT`, `FORCED_RESPONSE`):** Mandatory. The game engine must resolve them immediately and automatically upon their trigger condition without player intervention (e.g. _Nick Fury_ end-of-round discard, villain _When Revealed_ abilities).
   - **Standard Abilities (`INTERRUPT`, `RESPONSE`, `HERO_INTERRUPT`, `HERO_RESPONSE`):** **Strictly optional by player choice**. A player may choose to hold their reactive card or save their resources for a future window. The engine must never automatically spend cards from a player's hand without explicit player confirmation.

2. **Exact Event Scoping (Villain Activations vs. Minion Activations - RR v1.8 p. 25 "Scheme", p. 7 "Attack", p. 31 "Villain Phase"):**
   - Cards such as _Emergency_ (`01085`) specify: _"**Interrupt**: When the villain schemes, reduce the amount of threat placed on the scheme by 1."_
   - **The Villain is NOT a Minion:** Minions are separate enemy entities. When a minion schemes during Step 3 of the Villain Phase, it is a _Minion Activation_, **not** the _Villain Scheming_. Conflating minion threat with villain scheming creates false trigger windows.

3. **Form Invariance of Neutral Interrupts (RR v1.8 p. 13 "Form", p. 12 "Interrupt"):**
   - Cards with neutral `"timing": "INTERRUPT"` (like _Emergency_) lack the `"Hero"` or `"Alter-Ego"` prefix.
   - A player in **Hero form** or **Alter-Ego form** is legally permitted to trigger _Emergency_ whenever the villain schemes (e.g. against another teammate in Alter-Ego form or via treachery cards that cause the villain to scheme).

---

## Decision

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
