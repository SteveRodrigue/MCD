# [ADR-0028] Declarative Effect Sequencing, Conditional Gates, and Contextual Entity Passing

- **Status:** Superseded by [ADR-0030](0030-unified-ability-step-sequence-architecture.md)
- **Date:** 2026-08-31
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context

In Marvel Champions rules (RR v1.8), many card abilities consist of multiple distinct steps chained together, often with conditional dependencies such as the **"Then"** keyword (RR v1.8 p. 24), fallback surge triggers (e.g. "If no damage was healed, this card gains surge"), or sequential operations (e.g. "Change form, then draw up to hand size").

Prior to this architecture, such abilities were implemented via monolithic, specialized single-use primitives (e.g. `HEAL_DAMAGE_WITH_SURGE`, `ADD_STATUS_WITH_SURGE`, `CHANGE_FORM_DRAW_TO_HAND_SIZE`, `REVEAL_ENCOUNTER_CARD_WITH_SURGE`). This caused primitive bloat in the engine and prevented card abilities from composing generic atomic building blocks.

## Decision

1. **Declarative Step Sequence (`sequence: AbilityStep[]`):**
   - Extend `CardAbility` in `src/data/supplemental/schema.ts` and `src/engine/models/abilities.ts` with a recursive `sequence: CardAbility[]` array.
2. **Sequential Step Context & Result Pipeline:**
   - Thread `SequenceExecutionContext` containing `previousResult: StepResolutionResult` (`mutatedState`, `value`, `selectedCardInstanceIds`, `targetId`, `conditionMet`) from step to step.
3. **Conditional Gates (`gate: ConditionGate`):**
   - **`ALWAYS`** (Default): Executes unconditionally, adhering to RR v1.8 p. 2 "Do as much as you can".
   - **`THEN`** / **`IF_PREVIOUS_SUCCESS`**: Executes Step $N$ only if Step $N-1$ caused a non-zero state mutation (`mutatedState === true`), strictly enforcing RR v1.8 p. 24.
   - **`IF_AMOUNT_ZERO`** / **`IF_ZERO_HEALED`**: Executes Step $N$ if Step $N-1$ caused 0 state mutation (e.g. _Hard to Keep Down_ `01104` surging when villain is at full HP).
   - **`IF_ALREADY_HAS_STATUS`**: Executes Step $N$ if the target already has the status card before applying (e.g. _"I'm Tough"_ `01105` surging if villain is already Tough).
   - **`IF_FAILED`**: Executes Step $N$ if Step $N-1$ could not resolve.
   - **`IF_RESOURCE_MATCH`**: Evaluates whether a required resource type was spent during action payment.
4. **Data Passing:**
   - Subsequent steps can dynamically reference `target: "PREVIOUS_TARGET"` or `target: "PREVIOUS_SELECTED_CARD"`.
5. **Core Set Decomposition:**
   - Decompose composite single-use primitives into generic atomic building blocks across `core.json` and `core_encounter.json`.

## Consequences

- **Positive:** Eliminates monolithic single-use primitives across player and encounter cards.
- **Positive:** Standardizes "Then" keyword and conditional surge mechanics across the entire game engine.
- **Positive:** Preserves 100% decoupling between declarative supplemental data and engine execution.
