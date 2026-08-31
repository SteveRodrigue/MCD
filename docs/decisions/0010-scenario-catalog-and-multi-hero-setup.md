# ADR-0010: Scenario Catalog, Pre-built Starter Decks, and Multi-Hero Solo Setup Architecture

* **Status:** Superseded by [ADR-0033](0033-official-15-step-scenario-setup-engine-and-modular-plugin-pipeline.md)
* **Date:** 2026-08-26
* **Deciders:** Core Architecture Team
* **Consulted:** Rules Reference v1.8 (Setup Sequence p. 23–24), Learn to Play Guide
* **Informed:** MCD Engine & UI Developers

---

## Context and Problem Statement

*Marvel Champions: The Card Game* is fundamentally designed to support both **Solo** (single hero or multi-handed solo) and **Multiplayer** (2 to 4 heroes). Furthermore, scenario setup involves assembling distinct villain stages (Standard vs. Expert), main schemes with variable player scaling, modular encounter sets (e.g. *Bomb Scare*), and setting aside obligation/nemesis cards.

We needed a clean, scalable architecture to:
1. Define and select scenarios from an extensible **Scenario Catalog** without hardcoding Rhino in the game setup.
2. Provide **Pre-constructed Starter Decks** (e.g. Spider-Man Justice) loaded directly from the pack-modular catalog, avoiding premature deckbuilding complexity.
3. Support **Multi-Hero "Solo" mode** where 1 human player controls 1 to 4 hero seats with automatic, mathematical scaling of Villain HP ($N \times \text{HP}$) and Scheme Target Threat ($N \times \text{Threat}$).
4. Formalize the **Interactive Mulligan State Machine** (RR v1.8 Step 8) as an explicit engine reducer rather than an ad-hoc UI shortcut.

---

## Decision Drivers

* **Rules Authority Compliance (RR v1.8 p. 23–24):** Exact adherence to official 15-step setup (starting in Alter-Ego form, drawing printed hand size, discarding and redrawing during mulligan, shuffling discards back into deck).
* **Multi-Hero Solo Flexibility:** Seamlessly allow solo players to play true solo (1 hero) or two-handed/multi-hero (2–4 heroes).
* **Extensible Scenario & Modular Set Architecture:** Decouple villain identity, stage cards, main scheme 1A/1B, and modular sets so new scenarios (Klaw, Ultron, Mutagen Formula) can be added as data definitions.
* **Separation of Concerns:** Keep deck building separate from gameplay/setup flow.

---

## Considered Options

* **Option 1: Hardcoded Solo Setup with Instant Play:** Hardcode Spider-Man vs Rhino 1-player and skip setup/mulligan directly into Round 1.
* **Option 2: Full Deck Builder + Custom Scenario Builder:** Build a full deckbuilder UI and custom scenario constructor before supporting the core setup flow.
* **Option 3 (Chosen): Data-Driven Scenario Catalog + Pre-built Starter Decks + Multi-Hero Solo Engine with Interactive Mulligan:**
  * Define `ScenarioDefinition` with difficulty stage mapping and encounter deck factories.
  * Define `StarterDeckDefinition` with pre-built 40-card hero decks.
  * Formalize `GamePhase.SETUP_PHASE` with `RESOLVE_MULLIGAN` action reducer in the rules engine.

---

## Decision Outcome

**Chosen Option:** **Option 3**.

### Implementation Architecture:

1. **Scenario Catalog (`src/engine/scenarios/catalog.ts`):**
   * Encapsulates scenario metadata, villain stages (Standard I/II vs Expert II/III), recommended modular sets, and encounter deck factory functions.
2. **Starter Decks Registry (`src/engine/decks/starter-decks.ts`):**
   * Encapsulates 40-card pre-constructed hero starter decks loaded from pack-modular data.
3. **Multi-Hero Solo State & Scaling (`src/engine/state/game-setup.ts`):**
   * Instantiates $N$ separate `PlayerState` objects (`player_1` .. `player_N`).
   * Computes dynamic Villain HP ($\text{baseHP} \times N$) and Main Scheme Target Limit ($\text{baseThreat} \times N$).
4. **Mulligan Pipeline & Reducer (`src/engine/pipeline/action-dispatcher.ts`):**
   * Handles `RESOLVE_MULLIGAN` per hero seat:
     $$\text{hand} \leftarrow \text{keptCards} \cup \text{drawnReplacements}$$
     $$\text{deck} \leftarrow \text{shuffle}(\text{deck} \cup \text{mulliganDiscards})$$
   * Automatically transitions to `GamePhase.PLAYER_PHASE` Round 1 once all seats complete their mulligan.

---

## Consequences & Tradeoffs

### Positive:
* **True Multi-Hero Solo Support:** Players can immediately experience 1-player, 2-player, 3-player, and 4-player games with accurate villain HP and scheme scaling.
* **Zero Disruption to Deckbuilding:** Focuses on gameplay and setup without getting bogged down in deck validation UI.
* **100% Rules Reference Compliance:** Discarded mulligan cards are properly shuffled back into player decks and never touch the discard pile.
* **Ready for Content Expansion:** New scenarios and heroes can be added simply by registering new catalog entries.

### Negative / Tradeoffs:
* Requires multi-seat sequencing during the Mulligan UI phase (addressed by rendering clear "Hero Seat X of N" badges and sequential confirmation).
