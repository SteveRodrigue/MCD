# ADR-0020: Optional vs. Forced Trigger Decisions, Exact Event Scoping & Interactive Interrupt State Machine (RR v1.8)

## Status
Superseded by [ADR-0032](0032-universal-resolution-stack-decision-prompt-queue-and-nested-interrupts.md)

## Context & Problem Statement
In Marvel Champions rules architecture, triggers and reactive abilities (Interrupts and Responses) are among the most nuanced systems in the game. Conflating distinct enemy activations or treating optional player choices as automatic side-effects violates official timing rules and breaks tactical decision-making:

1. **Forced vs. Optional Abilities (RR v1.8 p. 11 "Forced", p. 12 "Interrupt", p. 19 "Response"):**
   * **Forced Abilities (`FORCED_INTERRUPT`, `FORCED_RESPONSE`):** Mandatory. The game engine must resolve them immediately and automatically upon their trigger condition without player intervention (e.g. *Nick Fury* end-of-round discard, villain *When Revealed* abilities).
   * **Standard Abilities (`INTERRUPT`, `RESPONSE`, `HERO_INTERRUPT`, `HERO_RESPONSE`):** **Strictly optional by player choice**. A player may choose to hold their reactive card or save their resources for a future window. The engine must never automatically spend cards from a player's hand without explicit player confirmation.

2. **Exact Event Scoping (Villain Activations vs. Minion Activations - RR v1.8 p. 25 "Scheme", p. 7 "Attack", p. 31 "Villain Phase"):**
   * Cards such as *Emergency* (`01085`) specify: *"**Interrupt**: When the villain schemes, reduce the amount of threat placed on the scheme by 1."*
   * **The Villain is NOT a Minion:** Minions are separate enemy entities. When a minion schemes during Step 3 of the Villain Phase, it is a *Minion Activation*, **not** the *Villain Scheming*. Conflating minion threat with villain scheming creates false trigger windows.

3. **Form Invariance of Neutral Interrupts (RR v1.8 p. 13 "Form", p. 12 "Interrupt"):**
   * Cards with neutral `"timing": "INTERRUPT"` (like *Emergency*) lack the `"Hero"` or `"Alter-Ego"` prefix.
   * A player in **Hero form** or **Alter-Ego form** is legally permitted to trigger *Emergency* whenever the villain schemes (e.g. against another teammate in Alter-Ego form or via treachery cards that cause the villain to scheme).

---

## Decision

We establish the **Trigger Classification & Interactive Interrupt Architecture**:

### 1. Granular Trigger Types (`TriggerType`)
We split broad event triggers into precise, distinct types:
* `'VILLAIN_SCHEMES'`: Fires when the main villain executes a Scheme activation (Step 2 of Villain Phase or via encounter card effect).
* `'MINION_SCHEMES'`: Fires when an engaged minion executes a Scheme activation (Step 3 of Villain Phase).
* `'VILLAIN_INITIATES_ATTACK'` / `'VILLAIN_ATTACKS'`: Fires when the villain executes an Attack activation.
* `'MINION_ATTACKS'`: Fires when an engaged minion executes an Attack activation.
* `'THREAT_WOULD_BE_PLACED'`: Generic threat placement from side schemes, attachments, or main scheme acceleration.

### 2. Mandatory vs. Optional Trigger Resolution
* **Forced Triggers:** Evaluated and resolved synchronously by `dispatchTrigger`.
* **Optional Triggers:**
  * When an optional interrupt trigger occurs, the engine pauses and populates `state.pendingInterruptPrompt`.
  * The UI renders an interactive **Pop-Art Decision Modal** asking the player whether to trigger the interrupt (e.g. *"Play Emergency to reduce threat by 1?"*).
  * If the player accepts $\rightarrow$ `RESOLVE_INTERRUPT_PROMPT` ({ accepted: true }) spends the card, executes the effect, and resumes phase execution.
  * If the player declines $\rightarrow$ `RESOLVE_INTERRUPT_PROMPT` ({ accepted: false }) leaves the card in hand and continues with unmitigated values.

### 3. Headless & Test Compatibility
For test automation and headless simulation, `dispatchTrigger` accepts an optional `acceptOptionalTriggers?: boolean` context parameter, ensuring full test determinism while supporting interactive UI gameplay.

---

## Consequences

* **Rules Reference v1.8 Compliance:** 100% adherence to official timing rules for forced vs optional abilities and enemy activation scoping.
* **Player Agency:** Players retain full strategic control over when to spend defensive/reactive cards from hand.
* **Extensibility:** All future Interrupts and Responses (defense cards, encounter card cancellations like *Enhanced Spider-Sense*, treachery cancels) integrate seamlessly into this prompt architecture.
