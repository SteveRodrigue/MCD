# Changelog

All notable changes to **Marvel Champions Digital (MCD)** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
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
