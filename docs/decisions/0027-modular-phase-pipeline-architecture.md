# [ADR-0027] Modular Phase Pipelines & Lifecycle Hooks

- **Status:** Accepted
- **Date:** 2026-08-30
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context & Problem Statement

Previously, `villain-phase.ts` served as a catch-all pipeline file containing not only Villain Phase Steps 1–5, but also Step 6 (Round Upkeep, card readying, hand replenishment, deck cycling, First Player token rotation, and new round initialization). This created an architectural coupling where round-level and phase-level lifecycle events were buried in villain machinery, and player phase transition helpers were dispersed.

Marvel Champions Rules Reference v1.8 formally delineates the game into two discrete phases (**Player Phase** and **Villain Phase**) bracketed by **Round Upkeep** and strict **Ability Limit Resets** (`usedAbilitiesThisPhase` vs `usedAbilitiesThisRound`).

## Decision Drivers

1. **Single Responsibility Principle:** `villain-phase.ts` must encapsulate strictly Steps 1 through 5 of the Villain Phase.
2. **First-Class Lifecycle Hooks:** Every phase boundary (`PLAYER_PHASE_BEGAN`, `PLAYER_PHASE_ENDED`, `VILLAIN_PHASE_BEGAN`, `VILLAIN_PHASE_ENDED`, `ROUND_BEGAN`, `ROUND_ENDED`) must be cleanly signaled through the trigger dispatcher.
3. **Strict Limit Enforcement:** Resets for once-per-phase and once-per-round abilities must execute reliably at the exact lifecycle boundaries.
4. **100% Backward Compatibility:** Re-export all pipeline symbols through `src/engine/pipeline/index.ts` with zero breaking changes.

## Considered Options

- **Option 1:** One File Per Phase & Lifecycle Stage (`player-phase.ts`, `villain-phase.ts`, `round-upkeep.ts`).
- **Option 2:** Unified Phase Orchestrator with low-level step helpers.
- **Option 3:** Single consolidated monolithic `round-pipeline.ts`.

## Decision Outcome

Adopted **Option 1 (Modular Phase Pipelines)**:

1. **`player-phase.ts`:**
   - Manages `startPlayerPhase`, `endPlayerPhase`, and `passActivePlayer`.
   - Resets `player.usedAbilitiesThisPhase = {}` upon phase start.
   - Dispatches `PLAYER_PHASE_BEGAN` and `PLAYER_PHASE_ENDED`.
2. **`villain-phase.ts`:**
   - Encapsulates Steps 1 through 5 (Threat, Interleaved Activations, Dealing, Reveals).
   - Resets `player.usedAbilitiesThisPhase = {}` upon phase start.
   - Dispatches `VILLAIN_PHASE_BEGAN` and `VILLAIN_PHASE_ENDED`.
   - Delegates Step 6 execution to `round-upkeep.ts`.
3. **`round-upkeep.ts`:**
   - Encapsulates `step6_passFirstPlayerAndRoundUpkeep`.
   - Dispatches `ROUND_ENDED` / `ROUND_END`.
   - Readies all in-play cards (identities, allies, tableau upgrades/supports).
   - Resets once-per-round limits: `usedAbilitiesThisRound = {}`, `basicChangeFormUsedThisRound = false`, `formChangedThisRound = false`, `recoveryUsedThisRound = false`.
   - Draws cards up to effective hand size, handling player deck recycling.
   - Passes First Player token clockwise.
   - Increments `roundNumber`, dispatches `ROUND_BEGAN`, and transitions into the new Player Phase.

## Consequences

- **Positive:**
  - Clean, modular, and maintainable pipeline architecture directly mirroring RR v1.8.
  - Every phase and round lifecycle transition is observable and hookable by card abilities and scenario rules.
  - Seamless backwards compatibility across all tests and UI components.
