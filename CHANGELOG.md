# Changelog

All notable changes to **Marvel Champions Digital (MCD)** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Game Settings & Developer Mode (ADR-0013):**
  - Persistent `GameSettingsContext` in local storage.
  - Interactive `OptionsMenu` dialog with toggle switches.
  - Visual `🛠️ DEV MODE: ON/OFF` indicator badge in top navigation bar with 1-click toggling.
- **Encounter Deck Dev Mode Inspector:**
  - Multi-tier sorting: `Deck Order` (with `Top to Bottom` / `Bottom to Top` toggles), `Card Type`, and `Encounter Set`.
  - Canonical Encounter Set labels displayed under each card using high-legibility sans-serif typography.
  - Smart redundancy removal (set labels automatically hidden when grouping by Encounter Set).
  - Unified grouping of all player obligations across 1–4 players under `Player Obligations`.
- **Player Deck Dev Mode Inspector:**
  - Multi-tier sorting: `Deck Order`, `Card Type`, `Affinity (Aspect)`, and `Cost`.
  - Cost sorting with `⬆️ Low to High (0 ⟶ 4+)` and `⬇️ High to Low (4+ ⟶ 0)` direction toggles.
  - Strict separation of numeric 0-cost cards vs. non-cost Resource cards (*Energy*, *Genius*, *Strength*) placed at the bottom.
- **Tabletop Stations & Layout Sizing:**
  - Shrunk Villain Station, Main Scheme Station, and Hero Identity Station to exact physical card dimensions (`w-fit shrink-0`).
  - Sized Health bars and Threat Limit gauges to fit physical card widths.
  - Dynamic horizontal expansion for Side Schemes, Allies, and Tableau cards.
- **Official Setup Pipeline (Steps 10 & 11):**
  - Automatic shuffling of player Obligation cards (*Eviction Notice*) into the encounter deck.
  - 5-card Nemesis Set (*Vulture*) isolated out of play on the right of the hand dock with click-to-inspect viewer modal.
- **Z-Axis Hover-Zoom (ADR-0012):**
  - Boundary-aware dynamic anchor detection (`useRef` + `getBoundingClientRect()`) preventing viewport clipping across all 4 edges.

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
