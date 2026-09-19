# [ADR-0068] Granular Villain Phase Stepper and Interactive Turn Pacing

- **Status:** Accepted
- **Date:** 2026-09-19
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

Previously, `executeVillainPhase` executed Steps 1 through 6 (Main Scheme Threat, Villain/Minion Activations, Deal Encounter Cards, Reveal Encounter Cards, and Round Upkeep) in a single continuous synchronous execution loop unless interrupted by a decision prompt. While this was efficient for headless simulation and batch test runs, it created significant presentation issues for human players in the web UI:

1. Rapid state transitions (threat placement, multiple attacks, boost card reveals, deal/reveal passes) occurred instantaneously without visual pacing.
2. Players were unable to read boost cards or see the breakdown of base ATK, boost icons, and defense before damage was applied.
3. Animation and visual effect hooks (such as damage splashes or future card movement animations) could not be triggered between discrete phase milestones.

Issue #140 requested an interactive step-by-step villain phase progression with full player pacing control (auto-advance with configurable speed, manual stepping, and instant resolution for experienced players), detailed combat boost resolution math, and comic pop-art damage splashes.

---

## Decision Drivers

- **RR v1.8 Precision:** Marvel Champions Rules Reference v1.8 (p. 22) outlines distinct sequential milestones for the Villain Phase.
- **Headless Engine Decoupling (ADR-0002):** The core rules engine must remain strictly headless, deterministic, and free of DOM, `setTimeout`, or React dependencies.
- **Player Agency & Pacing:** Players should control the speed of the phase (`Auto (Normal)`, `Auto (Fast)`, `Manual Step`, `Instant / Auto-Resolve`).
- **Combat Transparency:** Attack calculations ($\text{Base ATK} + \text{Boost Icons} = \text{Total ATK} \text{ vs } \text{DEF} \rightarrow \text{Damage}$) must be inspectable in a dedicated modal.
- **Visual Drama & Pop-Art Aesthetic (ADR-0004):** Combat impacts must feature explosive comic starbursts ("BANG! (-X HP)") and onomatopoeia.
- **Zero Simulation Regression:** Headless unit tests, fuzzers, and match simulators must continue to execute synchronously without required step looping.

---

## Considered Options

1. **Option 1: UI-Only Delay Wrapper (`setTimeout` inside React with Mock State Slicing)**
   - The engine continues to resolve the entire villain phase in one synchronous call; the UI records a timeline of diffs and plays them back with `setTimeout`.
2. **Option 2: Headless Discrete Stepper (`advanceVillainPhaseStep`) with Decoupled Visual Event Hooks and Configurable UI Pacing**
   - The engine models atomic step progression via an explicit `ADVANCE_VILLAIN_PHASE` action and `advanceVillainPhaseStep(state, options)` function.
   - `GameState` tracks the latest milestone (`villainPhaseStepEvent` and `lastCombatOutcome`).
   - The UI coordinates stepping with a timer or manual clicks, rendering `VillainPhaseStepper`, `CombatBoostModal`, and `ComicDamageSplash`.
3. **Option 3: Full Async/Promise Generator Pipeline in Engine**
   - Refactoring the entire engine pipeline into async generators (`async *executeVillainPhase`).

---

## Decision Outcome

**Chosen Option:** **Option 2: Headless Discrete Stepper (`advanceVillainPhaseStep`) with Decoupled Visual Event Hooks and Configurable UI Pacing**

### Rationale ("The Why")

Option 2 strictly upholds ADR-0002 by keeping the rules engine 100% headless, synchronous, and deterministic while providing first-class support for discrete progression:

1. **Deterministic State Machine:** Stepping is a pure function: `(GameState) -> GameState`. Given a state in `VILLAIN_PHASE`, calling `advanceVillainPhaseStep` moves the game to the next milestone and records `villainPhaseStepEvent` and `lastCombatOutcome`.
2. **Action-Driven Architecture:** Adding `ADVANCE_VILLAIN_PHASE` to `ActionType` integrates cleanly with `action-dispatcher.ts` and the `DailyBugleActionNewspaper` action pipeline.
3. **Extensibility for Animations:** `villainPhaseStepEvent` provides a standardized event bus on `GameState` for future animation pipelines (card glide animations, threat token animations).
4. **Flexible Pacing Controls:** Storing `villainPhasePacing` in `GameSettings` enables `auto_normal` (900ms), `auto_fast` (450ms), `manual` (spacebar/click), and `instant` (0ms, bypass stepping for lightning-fast simulation or speedrunners).
5. **Backwards Compatibility:** Synchronous callers (`match-simulator.ts`, legacy tests) continue using continuous execution when stepping is omitted.

---

## Evaluation of Options

### Option 1: UI-Only Delay Wrapper
- **Pros:** Zero changes to rules engine pipelines.
- **Cons:** Extremely fragile; UI timeline desynchronizes if a player is prompted to make an interactive interrupt choice mid-phase. Fails to support true manual stepping.

### Option 2: Headless Discrete Stepper
- **Pros:**
  - 100% testable rules engine without React/DOM.
  - Interactive interrupts halt cleanly at the exact sub-step.
  - Combat resolution math (`CombatResolutionSummary`) is authoritative.
  - Pure state transitions with clear onomatopoeia and event logging.
- **Cons:** Requires managing sub-step state (`pendingActivations`, dealt encounter card iteration) in `GameState`.

### Option 3: Full Async/Promise Generator Pipeline
- **Pros:** Natural async flow.
- **Cons:** Breaks synchronous engine contracts across hundreds of existing unit tests and match simulation loops.

---

## Consequences

### Positive Consequences
- **Transparent Combat:** `CombatBoostModal` clearly explains boost icons, star abilities, and defense mitigations.
- **Pop-Art Visual Punch:** `ComicDamageSplash` displays bold onomatopoeia starbursts over hero cards.
- **User Control:** Players can choose their preferred game speed in the Options Menu.
- **Rock-Solid Tests:** Stepping invariants and combat calculations can be asserted directly in Vitest unit tests.

### Negative Consequences / Risks & Mitigations
- *Risk:* If an interactive decision prompt opens during an activation or reveal, auto-advance timers might clash with player input.
  - *Mitigation:* `GameBoard` pauses any auto-advance timer whenever `pendingDecisionPrompt` is non-empty.
