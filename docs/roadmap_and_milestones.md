# Marvel Champions Digital (MCD) — Roadmap & Milestones

This document outlines the authoritative development roadmap for **Marvel Champions Digital**. It follows an iterative, **Capability-First, Headless-Engine Architecture**, ensuring the pure rules engine is proven out and verified with headless automated simulations before layering on visual polish and extended card sets.

---

## 🎯 Release Strategy & v1.0 Target Scope

* **v1.0 Core Release Objective:** Deliver a 100% polished, complete, and fully debugged **Core Set Experience** supporting **1 to 4 Heroes in Single Player mode (True Solo & Multi-Handed Solo)** against all 3 Core Set Villains (Rhino, Klaw, Ultron).
* **Future Official Content Releases (v1.1+):** Incremental releases organized by official Hero Packs, Scenario Packs, and Campaign Expansions.
* **Fan-Made / Custom Content Extensibility:** Supported natively via declarative Supplemental Card Data and the Scenario Plugin Architecture.

---

## 🏷️ Feature Prioritization Framework

All uncompleted and future roadmap items are categorized using the following priority scale:

| Level | Badge | Description | Target |
| :--- | :--- | :--- | :--- |
| **P0** | `🔴 [Must-Have]` | **Critical Path / Core Playability:** Non-negotiable for a fully functional, playable game loop. | Current Sprint |
| **P1** | `🟠 [Should-Have]` | **High Priority / Core Content:** Essential UX, complete Core Set cards, and key accessibility features. | Phase 3 & Phase 4 |
| **P2** | `🟡 [Nice-to-Have]` | **Polish & Ergonomics:** Visual flourishes, audio, mobile layout adaptations, and developer tooling. | Phase 4 & Phase 5 |
| **P3** | `🔵 [Future / Experimental]` | **Ecosystem & Distribution:** Native desktop binaries, multiplayer, and multi-language packs. | Phase 5+ |

---

## 🗺️ High-Level Roadmap Architecture

```mermaid
graph TD
    P0["Phase 0: Foundation & Governance ✅<br/>(Scaffolding, ADRs, Tooling, CI/CD)"] --> P1["Phase 1: Headless Engine & Schema Verification ✅<br/>(Deterministic State Tree, Supplemental Zod Schema, CI Tests)"]
    P1 --> P2["Phase 2: Rules Engine Robustness & Capability-Driven Pipeline 🚧<br/>(Resolution Stack, Combat Event Pipeline, Scenario Setup Plugin, Inbox Zero)"]
    P2 --> P3["Phase 3: Automated Headless Match Simulation 📅<br/>(Deterministic 100-Game Simulation Runner, Multi-Hero Collaboration)"]
    P3 --> P4["Phase 4: Comic Tabletop UI, Deck Import & Polish 🃏<br/>(MarvelCDB URL Import, Discard Inspectors, Payment Modals, Pop-Art UI)"]
    P4 --> P5["Phase 5: Expansions & Desktop Packaging 🚀<br/>(Hero & Scenario Packs, Tauri Desktop Binary, WebRTC P2P Multiplayer)"]
```

---

## 📍 Phase 0: Project Inception & Foundation ✅ (Completed)
* [x] **Architecture Decision Records (ADRs):** ADR-0001 through ADR-0029 created and indexed.
* [x] **Technology Selection:** TypeScript 5 + React 18 + Tailwind CSS + Vitest + Vite.
* [x] **Open-Source Governance:** MIT License, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, and CI workflow.
* [x] **Tooling & Scaffolding:** Vite 5, TypeScript 5, Vitest, Tailwind with Comic Theme, smoke tests verified.

---

## 📍 Phase 1: Headless Rules Engine & Schema Verification ✅ (Completed)
* [x] **Card Data Models & MarvelsDB Ingestion:** Ingest all Core Set cards with normalized schemas.
* [x] **Authoritative Zod Supplemental Schema (`schema.ts`):** Complete validation for `CardEnrichment`, `CardAbility`, `AbilityCost`, `FilterSchema`, `ConditionGate`, and `CardAuditRecord`.
* [x] **Automated Schema CI/CD Tests:** `tests/data/supplemental-schema.test.ts` validating 100% of supplemental packs.
* [x] **Modular Documentation Hub:** 10-part specification suite in `docs/specifications/supplemental/` with 🟢 `IMPLEMENTED` vs 🟡 `ROADMAP` status badges.
* [x] **Declarative Sequencing & Generic Zone Primitives (ADR-0028 & ADR-0029):** Atomic multi-step sequences (`sequence: []`), conditional gates (`gate: "ALWAYS" | "THEN" | "IF_AMOUNT_ZERO" | "IF_ALREADY_HAS_STATUS" | "IF_FAILED"`), and generic zone transfer primitives (`PUT_INTO_PLAY`, `SHUFFLE_INTO_DECK`).
* [x] **100% Core Set Encounter Pool Parity:** Multi-Stage Villain transitions (I $\rightarrow$ II $\rightarrow$ III), Option 3 Extra Activations (*Advance*, *Assault*, *Gang-Up*, *Explosion*, *Masterplan*, *Under Fire*), and Nemesis Spawning pipeline (*Shadow of the Past* `01190`).
* [x] **Mulligan Rules Alignment (RR v1.8 p. 23):** Discard pile placement with top replacement draws.
* [x] **Ergonomics & Action Engine:** 1960s Daily Bugle Action Dispatcher (`DailyBugleActionNewspaper.tsx`), form-aware Identity Action Modal (`IdentityActionModal.tsx`), and Dynamic Fan-Out Stack Hand layout (`useHandFanLayout.ts`).

---

## 📍 Phase 2: Rules Engine Robustness & Capability-Driven Pipeline 🚧 (Current Phase)
*Objective: Build an industrial-grade, capability-driven rules engine with complete nested resolution, a unified combat event pipeline, standardized scenario setup, and 100% Core Set card pool promotion (Inbox Zero).*

### 1. 🔴 `[Must-Have]` Completed Engine Foundations
* [x] **Interleaved Villain Phase Activations (RR v1.8 p. 22):**
  * Structured Step 2/3 as a unified player-by-player loop starting from the First Player.
* [x] **Sequential Hazard Icon Distribution (RR v1.8 p. 11) & Heroic Mode:**
  * Distributed extra encounter cards from Hazard icons sequentially in player order starting from the First Player (round-robin).
* [x] **Turn-Gated Form Changes (RR v1.8 p. 8):**
  * Basic 1/round form change limit tracked via `basicChangeFormUsedThisRound` with automatic reset on `ROUND_BEGAN`.

### 2. 🔴 `[Must-Have]` Milestone 2A: Universal Resolution Stack & Decision Prompt Queue ([ADR-0032](decisions/0032-universal-resolution-stack-decision-prompt-queue-and-nested-interrupts.md)) ✅ (Completed)
* [x] **Nested Action & Trigger Execution Stack (RR v1.8 p. 16, 24 / [ADR-0032](decisions/0032-universal-resolution-stack-decision-prompt-queue-and-nested-interrupts.md)):**
  * Supported interruption windows and execution frames (`ExecutionFrame`, `executionStack`) without state corruption.
  * Supported voluntary reaction windows with explicit "Pass / Do Nothing" options in `DecisionPromptModal`.
* [x] **Decision Prompt Queue Management:**
  * Transitioned from single prompt overwrite to structured FIFO prompt queue (`pendingDecisionQueue`), ensuring multiple triggered prompts resolve sequentially with visual queue depth badges.
* [x] **Promoted 5 Ambiguity Cards to 100% Confidence:** *Emergency* (`01085`), *Great Responsibility* (`01061`), *Get Behind Me!* (`01078`), *One-Two Punch* (`01024`), *Counter-Punch* (`01077`).

### 3. 🔴 `[Must-Have]` Milestone 2B: Comprehensive Combat, Enemy Attack & Multi-Window Defense Pipeline ([ADR-0031](decisions/0031-comprehensive-combat-enemy-attack-and-multi-window-defense-pipeline.md)) ✅ (Completed)
* [x] **Sub-Milestone 2B-1: Core Combat Lifecycle & Defender Declaration Engine ✅ (Completed):**
  * Built modular 7-step combat pipeline in `src/engine/pipeline/combat-pipeline.ts` ([ADR-0031](decisions/0031-comprehensive-combat-enemy-attack-and-multi-window-defense-pipeline.md)).
  * Step 1 Stun/Webbed Up check & Step 2 Initiation triggers (`VILLAIN_INITIATES_ATTACK` / *Spider-Sense* card draw).
  * Step 3 `DECLARE_DEFENDER` modal prompt with Basic Hero Defend (DEF mitigation), Ally Block, and Take Undefended.
  * Headless synchronous execution helper with configurable defense policy (`TAKE_UNDEFENDED`, `HERO_IF_READY`, `ALLY_CHUMP_BLOCK`, `AUTO_OPTIMAL`).
  * Promoted *Armored Vest* (`01081`) and *Indomitable* (`01082`) to 100% confidence.
* [x] **Sub-Milestone 2B-2: 0-to-Many Boost Queue, Star Abilities (★) & Boost Interrupts ✅ (Completed):**
  * Step 4 facedown boost deal queue ($N \ge 0$) and Step 5 iterative 1-by-1 boost reveal loop.
  * Boost Interrupt window (`WHEN_BOOST_CARD_REVEALED` / *Defiance*, *Target Acquired*).
  * ★ Star Boost abilities engine & dynamic boost card chaining (*Titania's Fury* `01164`, *Sweeping Swoop* `01168`, *Electric Whip Attack* `01173`, *Kree Manipulator* `01178`).
* [x] **Sub-Milestone 2B-3: Damage Prevention, Overkill, Retaliate & Direct Damage Invariant ✅ (Completed):**
  * Step 6 Damage Prevention Interrupts (*Backflip* `01003`, *Cosmic Flight* `01017`) and Tough preservation.
  * Overkill excess damage routing (bidirectional: Enemy $\rightarrow$ Defending Ally $\rightarrow$ Hero, Player $\rightarrow$ Minion $\rightarrow$ Villain) and `RETALIATE X` return damage in Step 7.
  * Direct damage vs. attack damage invariant (`dealDirectDamage`).
  * Promotes 8 Core Set cards: *Backflip* (`01003`), *Enhanced Spider-Sense* (`01004`), *Cosmic Flight* (`01017`), *Gamma Slam* (`01021`), *Hulk* (`01050`), *Tigra* (`01051`), *Relentless Assault* (`01053`), *Uppercut* (`01054`).

### 4. 🔴 `[Must-Have]` Milestone 2C: Scenario Setup & Modular Plugin Pipeline ([ADR-0033](decisions/0033-official-15-step-scenario-setup-engine-and-modular-plugin-pipeline.md))
* [ ] **Official 15-Step Scenario Setup Engine (RR v1.8 p. 27–28 / [ADR-0033](decisions/0033-official-15-step-scenario-setup-engine-and-modular-plugin-pipeline.md)):**
  * Refactor scenario initialization into declarative plug-in modules (`createGame(scenarioConfig, playerConfigs)`).
  * Enforce strict encounter set taxonomy: Scenario-Mandatory Sets (Villain set, Standard/Expert set, scenario-required secondary sets like *Prelates*) vs. Customizable Modular Slots.
  * Execute Main Scheme Stage 1A setup instructions (Villain placement, initial threat, starting side schemes, environments, attachments, encounter deck compilation, and player dealing) using generic zone primitives ([ADR-0029](decisions/0029-generic-zone-transfer-and-deck-manipulation-primitives.md)).
  * Standardize scenario plugins for Rhino, Klaw, and Ultron with plug-and-play modular encounter sets (*Bomb Scare*, *Masters of Evil*, *Under Attack*, *Legions of Hydra*, *The Doomsday Chair*).
* [ ] **Scenario Selection Screen & Modular Set Customizer (`ScenarioSelector.tsx`):**
  * Update `ScenarioSelector.tsx` to display locked scenario-mandatory set badges (`[🔒 MANDATORY]`).
  * Add modular encounter set slot selectors pre-populated with scenario default recommendations (e.g. *Bomb Scare* for Rhino, *Masters of Evil* for Klaw, *Under Attack* for Ultron), allowing players to replace optional sets with any modular set in their collection.
  * Provide a "Reset to Defaults" button and pass `selectedModularSetCodes` in `SetupSelection`.

### 5. 🔴 `[Must-Have]` Milestone 2D: Table Invariants, Deck Exhaustion & Core Set Promotion Pass (Inbox Zero)
* [ ] **Restricted Card Keyword Limit Engine (RR v1.8 p. 25 / [ADR-0018](decisions/0018-declarative-state-modifiers-and-dynamic-board-limits.md)):**
  - Implement dynamic restricted limit calculator (`getPlayerRestrictedLimit`, base 2).
  - Support heavy item weights ("Counts as 2 restricted cards", e.g. *Bazooka*, *Nightcrawler's Blades*).
  - Support dynamic limit expansion modifiers (e.g. *Side Holster*, *Venom*, *Prehensile Tail*).
  - Add voluntary discard replacement prompt (`DISCARD_RESTRICTED_REPLACEMENT`) in `canPlayCard()` when playing a restricted card at capacity.
* [ ] **Global Unique Card Rule & Identity Collision (RR v1.8 p. 29):**
  - Evaluate uniqueness globally across all active player tableaus, all player allies, and all in-game **Hero / Alter-Ego identities** (e.g. preventing *Captain Marvel* ally when *Carol Danvers* identity is in the game).
* [ ] **Mid-Action Player & Encounter Deck Exhaustion Invariants (RR v1.8 p. 11, 18):**
  - Guarantee immediate discard pile reshuffle and penalty application (1 acceleration token on main scheme for encounter deck; 1 facedown encounter card dealt to player for player deck) at any point during turn execution, milling, or card draws.
* [ ] **Promote 100% of Ambiguity Cards in `docs/ambiguities/` ([ADR-0021](decisions/0021-card-integration-workflow-and-composable-primitives.md), [ADR-0025](decisions/0025-architectural-subsystem-completion-and-mandatory-supplemental-review-pipeline.md), [ADR-0030](decisions/0030-unified-ability-step-sequence-architecture.md)):**
  - Execute Card Integration Protocol across all remaining 32 ambiguity files.
  - Promote all cards to $\ge 98\%$ confidence with dedicated unit tests.
  - Prune `docs/ambiguities/` to **0 files (Inbox Zero)**.
  - 100% Core Set Player Cards (all 5 Heroes) + 100% Rhino Encounter Pool executable in headless engine.

---

## 📍 Phase 3: Automated Headless Match Simulation & Multi-Hero Verification 📅 (Planned Next)
*Objective: Deliver a 100% automated, headless, deterministic game simulator capable of running full multi-round matches across all 5 Core Heroes against Rhino, Klaw, and Ultron ([ADR-0002](decisions/0002-decoupled-headless-rules-engine.md), [ADR-0009](decisions/0009-game-history-and-action-log.md)).*

### Milestones & Tasks
1. 🔴 `[Must-Have]` **Deterministic Monte Carlo Simulation Engine:**
   * Automated headless runner executing 100 complete simulated games (Spider-Man, Captain Marvel, She-Hulk, Iron Man, Black Panther) using heuristic legal action dispatchers.
   * Asserts zero state corruption, zero deadlocks, and verified win/loss condition evaluations.
2. 🔴 `[Must-Have]` **Multi-Hero Collaboration & Cooperative Triggers:**
   * Verify "Action: Ask another player to..." and cross-player resource/defense triggers (*Make the Call*, *Get Behind Me!*, *Helicarrier*, *Maria Hill*).
   * **`Alliance` Keyword Engine (RR v1.8 p. 4 / [ADR-0032](decisions/0032-universal-resolution-stack-decision-prompt-queue-and-nested-interrupts.md)):** Support collaborative multi-player resource pooling from hands and generators for Alliance cards.
   * **`Team-Up` Prerequisite Validator (RR v1.8 p. 28):** Validate dual-identity prerequisites across active identities and tableaus.

---

## 📍 Phase 4: Comic Tabletop UI, Deck Import & Visual Polish 🃏 (Planned)
*Objective: Connect the proven headless engine to our 1960s Pop-Art presentation layer with community deck import ([ADR-0004](decisions/0004-visual-art-direction-comic-pop-art.md), [ADR-0014](decisions/0014-marvelcdb-deck-schema-and-metadata-decks.md), [ADR-0017](decisions/0017-panoramic-horizontal-tabletop-and-edge-scrolling.md), [ADR-0026](decisions/0026-daily-bugle-action-dispatcher-and-dynamic-fan-out-hand.md)).*

### 1. 🟠 `[Should-Have]` Community Deck Import (MarvelCDB REST API - [ADR-0014](decisions/0014-marvelcdb-deck-schema-and-metadata-decks.md))
* [ ] 1-click **"Import Deck by MarvelCDB URL / ID"** button to load any community deck directly from `https://marvelcdb.com`.
* [ ] In-game deck validation checking aspect and unicity rules (40–50 cards).

### 2. 🟠 `[Should-Have]` Comic Tabletop UI Polish & Visual Ergonomics ([ADR-0017](decisions/0017-panoramic-horizontal-tabletop-and-edge-scrolling.md), [ADR-0026](decisions/0026-daily-bugle-action-dispatcher-and-dynamic-fan-out-hand.md))
* [ ] **Discard Pile Inspectors with Multi-Tier Sorting Options:**
  * Interactive modal to inspect Player Discard and Encounter Discard piles with sorting toggles (Chronological, Card Type, Aspect, Cost, Alphabetical) preserving underlying state order.
* [ ] **Interactive Card Play & Resource Payment Modal:**
  * Select resources from hand cards and exhausted generators (*Web-Shooter*, *Helicarrier*, *Rechannel*).
* [ ] **Turn Pass & Step-by-Step Activation Banners.**

### 3. 🟡 `[Nice-to-Have]` Visual & Audio Polish
* [ ] Dynamic Onomatopoeia starburst overlays (*POW!*, *BAM!*, *KAPOW!*, *THWIP!* - [ADR-0004](decisions/0004-visual-art-direction-comic-pop-art.md)).
* [ ] Retro comic action sound effects and card dealing chimes.
* [ ] Standalone In-Game Visual Deckbuilder (secondary to MarvelCDB import).

---

## 📍 Phase 5: Expansion Waves, Advanced Mechanics & Native Ecosystem 🚀 (Planned)
*Objective: Scale the engine to support advanced expansion mechanics, new card types, multi-form identities, and native platforms.*

### 1. 🔴 `[Must-Have]` Milestone 5A: Player Side Schemes, Victory Display & Auxiliary Decks ([ADR-0034](decisions/0034-player-side-schemes-victory-display-and-auxiliary-decks.md))
* [ ] **Player Side Scheme Execution Engine (`player_side_scheme` - RR v1.8 p. 26 / [ADR-0034](decisions/0034-player-side-schemes-victory-display-and-auxiliary-decks.md)):**
  * Support voluntary player side schemes with printed threat and "When Defeated" player reward step sequences.
  * Enable heroes and allies to target player side schemes with basic thwart and thwart events.
* [ ] **Persistent Victory Display (`state.victoryDisplay` - RR v1.8 p. 30):**
  * Route defeated `Victory X` schemes and minions to the Victory Display zone to prevent deck recycling and track victory scores.
* [ ] **Auxiliary Scenario Decks (`auxiliaryDecks` & `auxiliaryDiscards`):**
  * Support modular auxiliary decks for complex campaign scenarios (*Infinity Gauntlet*, *Holding Cell*, *Market*, *Evidence*).

### 2. 🔴 `[Must-Have]` Milestone 5B: Multi-Form Identities & Universal Counter Engine ([ADR-0035](decisions/0035-universal-multi-form-identities-and-generic-counter-engine.md))
* [ ] **Multi-Form Identity Scaling (3-Sided & Mass/Energy Forms - RR v1.8 p. 12 / [ADR-0035](decisions/0035-universal-multi-form-identities-and-generic-counter-engine.md)):**
  * Support 3-sided identities (*Ant-Man*, *Wasp*), Energy Forms (*Spectrum*), Mass Forms (*Vision*, *Shadowcat*), and Progression levels (*Ironheart*).
  * Dispatch discrete `FORM_CHANGED` lifecycle events with form-entry ability step triggers.
* [ ] **Universal Dynamic Counter Map (`counters: Record<string, number>`):**
  * Generic counter engine supporting all 51 catalog counter types (*Charge*, *Ammo*, *Arrow*, *Web*, *Chi*, *Labor*, *Pym*, *Time*) via atomic `ADD_COUNTERS`, `SPEND_COUNTERS`, and `REMOVE_COUNTERS_MATCHING_FILTER` primitives.

### 3. 🔴 `[Must-Have]` Milestone 5C: Advanced Status Scaling & Minion Entry Modifiers ([ADR-0036](decisions/0036-advanced-status-card-dynamics-and-minion-activations.md))
* [ ] **Count-Based Status Thresholds (RR v1.8 p. 28 / [ADR-0036](decisions/0036-advanced-status-card-dynamics-and-minion-activations.md)):**
  * Support **`Stalwart`** (status immunity) and **`Steady`** (requires 2 status cards to cancel actions).
* [ ] **Minion Combat & Threat Modifiers (RR v1.8 p. 14, 16, 18, 30):**
  * **`Villainous` Keyword:** Minions draw and resolve facedown boost cards when activating.
  * **`Quickstrike` Keyword:** Minions immediately trigger an attack activation upon engaging a Hero.
  * **`Incite X` & `Hinder X`:** Threat modifiers executed upon encounter card entry.

### 4. 🟠 `[Should-Have]` Official Pack Rollout Pipeline
* [ ] Incremental pack integration: Captain America, Ms. Marvel, Thor, Doctor Strange, Rise of Red Skull, Green Goblin, Galaxy's Most Wanted, Mad Titan's Shadow, Sinister Motives, Mutant Genesis, Next Evolution, Age of Apocalypse.

### 5. 🔵 `[Future / Experimental]` Native Desktop & Network Multiplayer
* [ ] **Native Desktop Executable (Tauri - [ADR-0003](decisions/0003-technology-stack-selection.md)):** Standalone Windows/Mac/Linux binaries with ultra-low memory footprint.
* [ ] **Peer-to-Peer Network Multiplayer (WebRTC):** Synchronized state room for 2–4 players over WebSockets/WebRTC.
