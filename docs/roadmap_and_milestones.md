# Marvel Champions Digital (MCD) — Roadmap & Milestones

This document outlines the authoritative development roadmap for **Marvel Champions Digital**. It follows an iterative, **Vertical Slice** approach, ensuring the pure rules engine is proven out and tested before layering on visual polish and extended card sets.

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
    P1 --> P2["Phase 2: Engine Robustness & Scenario Setup Pipeline 🚧<br/>(Scenario Setup Plugins, Rhino Card Parity, Interleaved Step 2/3 Activations)"]
    P2 --> P3["Phase 3: 2-Hero Vertical Slice Matchup 📅<br/>(Spider-Man + Captain Marvel vs Rhino: 100% Debugged Multi-Handed Matchup)"]
    P3 --> P4["Phase 4: Core Set Completion & Polish 🃏<br/>(All 5 Core Heroes, Klaw, Ultron, MarvelCDB URL Import, Pop-Art UI)"]
    P4 --> P5["Phase 5: Expansions & Desktop Packaging 🚀<br/>(Hero & Scenario Packs, Tauri Desktop Binary, WebRTC P2P Multiplayer)"]
```

---

## 📍 Phase 0: Project Inception & Foundation ✅ (Completed)
* [x] **Architecture Decision Records (ADRs):** ADR-0001 through ADR-0026 created and indexed.
* [x] **Technology Selection:** TypeScript 5 + React 18 + Tailwind CSS + Vitest + Vite.
* [x] **Open-Source Governance:** MIT License, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, and CI workflow.
* [x] **Tooling & Scaffolding:** Vite 5, TypeScript 5, Vitest, Tailwind with Comic Theme, smoke tests verified.

---

## 📍 Phase 1: Headless Rules Engine & Schema Verification ✅ (Completed)
* [x] **Card Data Models & MarvelsDB Ingestion:** Ingest all Core Set cards with normalized schemas.
* [x] **Authoritative Zod Supplemental Schema (`schema.ts`):** Complete validation for `CardEnrichment`, `CardAbility`, `AbilityCost`, `FilterSchema`, and `CardAuditRecord`.
* [x] **Automated Schema CI/CD Tests:** `tests/data/supplemental-schema.test.ts` validating 100% of supplemental packs.
* [x] **Modular Documentation Hub:** 10-part specification suite in `docs/specifications/supplemental/` with 🟢 `IMPLEMENTED` vs 🟡 `ROADMAP` status badges.
* [x] **Hero & Scenario Creation Guides:** Standardized authoring guides for community and official expansion packs.
* [x] **100% Core Set Encounter Pool Parity:** Multi-Stage Villain transitions (I $\rightarrow$ II $\rightarrow$ III), Option 3 Extra Activations (*Advance*, *Assault*, *Gang-Up*, *Explosion*, *Masterplan*, *Under Fire*), and Nemesis Spawning pipeline (*Shadow of the Past* `01190`).
* [x] **Mulligan Rules Alignment (RR v1.8 p. 23):** Discard pile placement with top replacement draws.
* [x] **Ergonomics & Action Engine:** 1960s Daily Bugle Action Dispatcher (`DailyBugleActionNewspaper.tsx`), form-aware Identity Action Modal (`IdentityActionModal.tsx`), and Dynamic Fan-Out Stack Hand layout (`useHandFanLayout.ts`).

---

## 📍 Phase 2: Rules Engine Robustness & Nested Timing Architecture 🚧 (Current Sprint)
*Objective: Build an industrial-grade, event-driven rules engine with complete nested resolution and correct multiplayer turn loops.*

### 1. 🔴 `[Must-Have]` Interleaved Villain Phase Activations (RR v1.8 p. 22)
* [x] **Interleaved Player-by-Player Activation Loop:**
  * Structure Step 2/3 as a unified loop starting from the First Player:
    $$\text{For each player (starting at First Player)} \rightarrow \text{Villain activates against player} \rightarrow \text{Engaged minions activate against player}.$$
* [x] **Sequential Hazard Icon Distribution (RR v1.8 p. 11) & Heroic Mode:**
  * Distribute extra encounter cards from Hazard icons sequentially in player order starting from the First Player (round-robin), with orthogonal Heroic Level support.

### 2. 🔴 `[Must-Have]` Nested Resolution Stack & Decision Prompt Queue (RR v1.8 p. 16, 24)
* [ ] **Nested Action & Trigger Execution Stack:**
  * Support interruption windows opening inside active action/activation windows without state corruption.
  * Allow voluntary reactions with explicit "Pass / Do Nothing" options in `DecisionPromptModal`.
  * Support player-ordered resolution when multiple `FORCED` triggers fire simultaneously (RR v1.8 p. 16).
* [ ] **Turn-Gated Form Changes (`basicChangeFormUsedThisRound`):**
  * Track natural 1/round basic flip action separately from card-effect flips (e.g. *Split Personality* `01025`).

### 3. 🔴 `[Must-Have]` Event-Driven Combat & Action Signals
* [ ] **Direct Damage vs Attack Damage Distinction:**
  * Formally differentiate damage caused by an *Attack* (triggers Defense, Retaliate, Guard) from *Direct Damage* (e.g. *Ground Stomp*, *Energy Channel*).
* [ ] **Event Dispatcher Hooks:**
  * Fire discrete engine events for `OVERKILL_OCCURRED` (tracking excess overkill damage), `ALLY_CONSEQUENTIAL_DAMAGE`, `THWART_COMPLETED`, and `RECOVER_COMPLETED`.
* [ ] **Action Frequency Limits:**
  * Enforce `maxPerRound` and `maxPerPhase` tracking in `GameState`.
* [ ] 🟠 `[Should-Have]` **Rules Review & Implementation of Information Visibility (RR v1.8 p. 8, 9):**
  * Formalize inspection rights in UI and engine:
    * **Discard Piles (Open Information):** Any player may inspect any discard pile (Player Discard, Encounter Discard) at any time during the game without altering the physical card order.
### 4. 🔴 `[Must-Have]` Modular Scenario Setup Pipeline (Plug-in Architecture)
* [ ] **Official 15-Step Scenario Setup Pipeline (RR v1.8 p. 27–28):**
  * Refactor Scenario Setup into a plug-in module system executing Main Scheme Stage 1A setup instructions (Villain placement, initial threat, starting side schemes, environments, attachments, encounter deck compilation, and player dealing).
  * Eliminate ad-hoc setup logic, ensuring scenarios configure themselves via declarative scenario plugins (`src/engine/scenarios/`).

### 5. 🔴 `[Must-Have]` 100% Rhino Scenario Card Pool Integration & Verification
* [ ] **Complete Rhino Encounter Pool Verification:**
  * Ensure 100% of cards in the Rhino Scenario encounter pool are fully enriched, schema-validated, and verified with unit tests:
    * **Rhino Signature Set:** *Rhino (Stage I, II, III)*, *The Break-In! (1A/1B)*, *Rhino's Charge* (`01098`), *Armored Rhino Suit* (`01099`), *Hard to Keep Down* (`01104`), *Stampede* (`01105`), *I'm Tough!* (`01106`), *Breakin' & Takin'* (`01107`), *Hydra Mercenary* (`01108`), *Hydra Bomber* (`01109`), *Crowd Control* (`01110`).
    * **Modular Set (Bomb Scare):** *Bomb Scare* (`01114`), *Explosion* (`01115`), *False Alarm* (`01116`).
    * **Standard Set (I):** *Advance* (`01186`), *Assault* (`01187`), *Caught in a Trenchcoat* (`01188`), *Gang-Up* (`01189`), *Shadow of the Past* (`01190`), *Under Fire* (`01192`), *Masterplan* (`01193`).

---

## 📍 Phase 3: 2-Hero Multi-Handed Vertical Slice Matchup 📅 (Planned Next)
*Objective: Deliver a 100% automated, fully working, and deeply playable multi-handed solo game: **Spider-Man (Justice) + Captain Marvel (Leadership) vs Rhino (Standard I + Bomb Scare)**.*

### Milestones & Tasks
1. 🔴 `[Must-Have]` **Spider-Man & Captain Marvel Full Signature Parity:**
   * [x] Spider-Man signature cards: *Spider-Sense*, *Backflip*, *Swinging Web Kick*, *Spider-Tracer*, *Aunt May*, *Web-Shooter*.
   * [ ] Captain Marvel signature cards: *Rechannel*, *Crisis Intervenor*, *Photonic Blast*, *Energy Channel* (energy token accumulation), *Cosmic Flight*, *Captain Marvel's Helmet*.
2. 🔴 `[Must-Have]` **Dynamic Hand Size & Tech Upgrades (Issue #9):**
   * [x] Continuous aura modifying live effective hand size dynamically during round upkeep and UI rendering (*Iron Man* `01029a`, *Arc Reactor*, *Mark V Armor*, *Rocket Boots*).
   * [x] Tony Stark *Futurist* scrying ability with interactive player choice prompt (`DecisionPromptModal.tsx`).
3. 🔴 `[Must-Have]` **2-Hero Multi-Handed Solo Automated Match Simulation:**
   * [ ] Automated end-to-end game simulation verifying full win/loss conditions with 2 heroes collaborating against Rhino across multiple rounds.

---

## 📍 Phase 4: Core Set Content, Deck Import & UI Polish 🃏 (Planned)
*Objective: Deliver all 5 Core Set Heroes, all 3 Core Set Villains, and responsive Comic Tabletop ergonomics.*

### 1. 🔴 `[Must-Have]` Remaining Core Heroes & Villains
* [ ] **Core Heroes:** *She-Hulk* (Aggression), *Iron Man* (Aggression), *Black Panther* (Protection with *Wakanda Forever!* Special upgrade pipeline).
* [ ] **Core Villains & Modulars:** *Klaw* (Stage I/II + Weapons Runner), *Ultron* (Stage I/II + Drone mechanics), *Masters of Evil*, *Under Attack*, *Legions of Hydra*, *The Doomsday Chair*.

### 2. 🟠 `[Should-Have]` Community Deck Import (MarvelCDB REST API)
* [ ] 1-click **"Import Deck by MarvelCDB URL / ID"** button to load any community deck directly from `https://marvelcdb.com`.
* [ ] In-game deck validation checking aspect and unicity rules (40–50 cards).

### 3. 🟠 `[Should-Have]` Comic Tabletop UI Polish & Visual Ergonomics
* [ ] **Discard Pile Inspectors with Multi-Tier Sorting Options:**
  * Interactive modal to inspect Player Discard and Encounter Discard piles with sorting toggles (Discard Chronological Order, Card Type, Aspect/Faction, Cost, Alphabetical) while preserving underlying state order.
* [x] **Card Exhaustion Visuals:** Subtle 15-degree tilt (`rotate-[15deg]`) with desaturated overlay and `EXHAUSTED` badge.
* [ ] **Interactive Card Play & Resource Payment Modal:** Select resources from hand cards and exhausted generators (*Web-Shooter*, *Helicarrier*, *Rechannel*).
* [ ] **Turn Pass & Step-by-Step Activation Banners.**

### 4. 🟡 `[Nice-to-Have]` Visual & Audio Polish
* [ ] Dynamic Onomatopoeia starburst overlays (*POW!*, *BAM!*, *KAPOW!*, *THWIP!*).
* [ ] Retro comic action sound effects and card dealing chimes.
* [ ] Standalone In-Game Visual Deckbuilder (secondary to MarvelCDB import).

---

## 📍 Phase 5: Expansions, Native Desktop & Ecosystem 🚀 (Planned)
*Objective: Expansion packaging, native binaries, and multiplayer connectivity.*

* 🔴 `[Must-Have]` **Official Pack Rollout Pipeline:** Incremental releases for Captain America, Ms. Marvel, Thor, Doctor Strange, Rise of Red Skull, Green Goblin, etc.
* 🟠 `[Should-Have]` **Power-User Keyboard Shortcuts:** Configurable hotkeys (`Space`, `F`, `A`, `T`, `R`, `1`–`9`, `Esc`).
* 🟡 `[Nice-to-Have]` **Responsive Tablet / Mobile Portrait Mode:** Adaptive 1-column layout for mobile devices.
* 🔵 `[Future / Experimental]` **Native Desktop Executable (Tauri):** Standalone Windows/Mac/Linux binaries with ultra-low memory footprint.
* 🔵 `[Future / Experimental]` **Peer-to-Peer Network Multiplayer (WebRTC):** Synchronized state room for 2–4 players over WebSockets/WebRTC.
