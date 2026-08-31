# Changelog

All notable changes to **Marvel Champions Digital (MCD)** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

- **Turn-Gated Form Changes & Phase/Round Lifecycle Triggers (RR v1.8 p. 8, 22, 24):**
  - Enforced official 1/round basic form change limit (`basicChangeFormUsedThisRound: boolean`) across engine and UI (`canChangeForm`, `HeroZone.tsx`, `IdentityActionModal.tsx`).
  - Separated card-effect form flips (e.g. *Split Personality* `01025`) from basic form flips, allowing card effects to flip identity without consuming the once-per-round basic action limit.
  - Implemented `CHANGE_FORM_DRAW_TO_HAND_SIZE` effect primitive and promoted *Split Personality* (`01025`) to 98% confidence, resolving and deleting ambiguity report `core_01025_split_personality.md` (Inbox Zero).
  - Established formal phase and round lifecycle trigger pipeline (`ROUND_BEGAN`, `ROUND_ENDED`, `PLAYER_PHASE_BEGAN`, `PLAYER_PHASE_ENDED`, `VILLAIN_PHASE_BEGAN`, `VILLAIN_PHASE_ENDED`).
  - Automated round reset of `basicChangeFormUsedThisRound = false` upon new round transition in `step6_passFirstPlayerAndRoundUpkeep`.
  - Added unit test suites `tests/engine/form-change-rules.test.ts` and `tests/engine/lifecycle-triggers.test.ts`.
- **Heroic Mode & Difficulty Controls in UI Settings & Scenario Selector:**
  - Added dedicated difficulty selection buttons (`SKIRMISH`, `STANDARD`, `EXPERT`) and **Heroic Mode Variant** level selectors (`Off`, `Heroic 1`, `Heroic 2`, `Heroic 3`) to `ScenarioSelector.tsx`.
  - Added visual badges distinguishing `⭐ OFFICIAL FFG HEROIC MODE` (on Expert) from `⚡ CUSTOM VARIANT` (on Standard / Skirmish).
  - Added persistent default difficulty and Heroic level preferences in `GameSettingsContext.tsx` and `OptionsMenu.tsx`.
  - Connected `App.tsx` $\rightarrow$ `setupGame` to seamlessly pass `difficulty` and `heroicLevel` into the live game state.
- **Sequential Hazard Icon Distribution & Heroic Mode (RR v1.8 p. 11, p. 22):**
  - Refactored Step 4 of the Villain Phase in `src/engine/pipeline/villain-phase.ts` to implement official two-pass encounter card dealing.
  - **Pass 1 (Base & Heroic):** Deals $1 + \text{heroicLevel}$ encounter cards to each player in player order starting with the First Player.
  - **Pass 2 (Hazard Icons):** Deals 1 extra encounter card per active Hazard icon sequentially in player order starting from the First Player (round-robin).
  - Orthogonalized `heroicLevel` ($0, 1, 2 \dots$) from `DifficultyMode` (`SKIRMISH`, `STANDARD`, `EXPERT`), allowing Heroic variants across all game modes.
  - Added test suite `tests/engine/keywords-hazard.test.ts`.
- **Interleaved Villain & Minion Activations (RR v1.8 p. 22):**
  - Restructured Step 2 of the Villain Phase in `src/engine/pipeline/villain-phase.ts` to follow the official player-by-player activation loop starting from the First Player.
  - For each player in player order: the villain activates against the player (Attacks if hero, Schemes if alter-ego), followed immediately by all minions engaged with that player activating against them.
  - Implemented `executeMinionSchemeAgainstPlayer` so that minions add threat equal to their SCH stat when their engaged player is in Alter-Ego form.
  - Added unit test coverage for multi-player interleaved activation sequences and first player rotation.
- **1960s Daily Bugle Action Dispatcher & Auto End-Turn Flow (ADR-0021):**
  - Built pure engine evaluator `legal-actions-generator.ts` discovering legal basic attacks, thwarts, card plays, and ability activations.
  - Interactive retro newspaper broadsheet `DailyBugleActionNewspaper.tsx` with woodblock masthead, columnar action dispatches, and click-to-execute controls.
  - Automatic `EndTurnConfirmationModal.tsx` prompting confirmation when only "End Turn" remains.
  - Top navigation bar hover/click button `📰 DAILY BUGLE [N]` displaying live actionable count badge.
- **Identity Action Console & Modal:**
  - Interactive `IdentityActionModal.tsx` opened by clicking Identity card (Tony Stark / Iron Man).
  - Lists form-aware actions: Recover (greyed out when at full health with HP explanation), Identity Abilities (e.g. *Futurist*), Basic Attacks/Thwarts, and Suit Up/Flip.
- **Interactive Player Decision Prompt for Scrying (*Futurist*):**
  - Strict RR v1.8 p. 19 ("Player Choice") implementation for scrying abilities in `src/engine/effects/index.ts`.
  - Visual **DECISION REQUIRED** prompt (`DecisionPromptModal.tsx`) showing top 3 revealed cards side-by-side with non-matching cards cleanly grayed out and selectable Tech cards highlighted.
  - Explicit option to decline and discard all revealed cards.
- **Dynamic Fan-Out Stack Hand Layout (Zero Overflow):**
  - Responsive `useHandFanLayout.ts` hook measuring container width and dynamically tightening negative margins to prevent hand overflow across any hand size (6, 7, 8+ cards).
  - Leftmost card in hand stacked on top (`z-index: 30 - index`).
  - Active hovered card elevated to `z-index: 60` with upward float elevation (`-translate-y-12`) and unconstrained 1.9× Comic Zoom.
  - Hardware-accelerated `transition-transform duration-150` eliminating sluggish accordion compression on card additions.

### Changed
- **Physical Game Counter Token Styling:**
  - Standard game counters rendered as solid green rounded-squares in the bottom-right corner of cards (`CardView.tsx`) replicating physical tabletop tokens.

### Fixed
- **Resource Card Play Legality (RR v1.8 p. 24):**
  - Enforced in `legality-checker.ts` that standalone Resource cards (*Energy*, *Genius*, *Strength*) cannot be played as independent actions; they are discarded strictly during resource payment.
- **Interactive Tableau & Ally Triggers:**
  - Added click handlers and action mini-bars (`[⚡ USE]`, `[⚔️ ATK]`, `[🛡️ THW]`) for tableau upgrades/supports and allies in `HeroZone.tsx`.
- **Solid Matte Grayscale Rendering (No Transparency):**
  - Removed `opacity-40` and `opacity-65` from unplayable/non-matching cards across `DecisionPromptModal.tsx` and `CardView.tsx`, ensuring 100% solid, opaque cards without background bleed.
- **Modal Z-Axis and Clipping:**
  - Removed `overflow-hidden` from `DecisionPromptModal.tsx` and elevated hovered card wrapper z-index so zoomed cards never get cropped.

---

## [0.1.0] - 2026-08-26

### Added
- **Headless Rules Engine (ADR-0002):**
  - Deterministic state machine covering Player Phase, Villain Phase, and status effects (*Tough*, *Stunned*, *Confused*).
  - Action pipeline with nested trigger priority (Forced Interrupts, Interrupts, Replacement Effects, Forced Responses, Responses).
  - Full automated scenario validation for *Spider-Man (Justice) vs. Rhino (Standard I + Bomb Scare)* with 56 unit tests.
- **Data-Driven Card Catalog (ADR-0006):**
  - Ingestion of official `marvelsdb-json-data` core and encounter sets.
  - Orientation metadata and cache-first MarvelCDB card art loader (ADR-0011).
- **60s Comic Pop-Art Presentation Layer (ADR-0004):**
  - Ben-Day halftone dot pattern overlays and retro comic panel borders.
  - Interactive multi-hero setup and Mulligan phase state machine (ADR-0010).
- **Project Infrastructure & Architecture Records:**
  - Architecture Decision Records ADR-0001 through ADR-0010.
  - Vitest test suite, TypeScript 5 strict type checking, and GitHub Actions CI workflow.
