# Architecture Decision Records (ADRs) & Decision Log

This directory captures all key architectural, technical, and gameplay design decisions made for **Marvel Champions Digital (MCD)**, with an emphasis on **the rationale ("the why")**, tradeoffs, and consequences.

## Format
We follow the standard [Architecture Decision Record (ADR)](https://github.com/joelparkerhenderson/architecture-decision-record) format based on Michael Nygard / MADR standards.

Each record documents:
* **Context & Problem Statement:** What situation or challenge we are addressing.
* **Decision Drivers:** What requirements, goals, or constraints matter most.
* **Considered Options:** What alternatives were evaluated.
* **Decision Outcome:** What we chose and **why**.
* **Pros and Cons of the Options:** Explicit tradeoffs.
* **Consequences:** Positive and negative impacts on the project.

---

## Decision Log Table

| ID | Date | Title | Status | Primary Rationale / Why |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-0001](0001-record-architecture-decisions.md) | 2026-08-26 | Use Architecture Decision Records (ADRs) | **Accepted** | Ensure all technical choices and their underlying "why" are transparent, traceable, and persistent across development. |
| [ADR-0002](0002-decoupled-headless-rules-engine.md) | 2026-08-26 | Decoupled Headless Rules Engine | **Accepted** | Marvel Champions rules and timing triggers require 100% deterministic, test-driven validation independent of any UI or rendering framework. |
| [ADR-0003](0003-technology-stack-selection.md) | 2026-08-26 | Technology Stack Selection | **Accepted** | Evaluate TypeScript/React/Tauri vs Godot vs Unity vs Python with FOSS licensing and rapid UI prototyping. |
| [ADR-0004](0004-visual-art-direction-comic-pop-art.md) | 2026-08-26 | 60s Comic Pop-Art & Batman '66 Aesthetic | **Accepted** | Focus on 2D comic panels, Ben-Day halftone dots, and punchy onomatopoeia (POW! BAM! THWIP!) instead of heavy 3D graphics. |
| [ADR-0005](0005-internationalization-i18n-localization.md) | 2026-08-26 | Internationalization (i18n) & Localization | **Accepted** | Decouple all UI/game text and card data into JSON locale dictionaries (i18next) for easy multi-language translation and community contributions. |
| [ADR-0006](0006-local-first-card-data-architecture.md) | 2026-08-26 | Local-First Card Data & Layered Overrides | **Accepted** | Keep a 100% local copy of all card data with an explicit sync workflow and a supplemental/override layer for engine hooks and errata. |
| [ADR-0007](0007-official-rules-authority-rr-v18.md) | 2026-08-26 | Official Rules Authority (RR v1.8 & Errata) | **Accepted** | All game mechanics, timing windows, and errata must strictly adhere to the official Rules Reference v1.8 and Learn to Play Guide. |
| [ADR-0008](0008-declarative-card-ability-enrichment.md) | 2026-08-26 | Declarative Card Ability & Effect Enrichment | **Accepted** | Declarative supplemental ability layer with reusable effect primitives, 100% card registration, and explicit status signals. |
| [ADR-0009](0009-game-history-and-action-log.md) | 2026-08-26 | In-Game Action History & Real-Time Combat Log | **Accepted** | Implement a strictly ordered, immutable log of game events to support undo mechanics, replayability, and debugging. |
| [ADR-0010](0010-scenario-catalog-and-multi-hero-setup.md) | 2026-08-26 | Scenario Catalog & Multi-Hero Solo Setup Architecture | **Accepted** | Decouple scenarios and starter decks into registries with automatic multi-hero (1–4) scaling and an interactive Mulligan state machine. |
| [ADR-0011](0011-card-orientation-and-art-caching.md) | 2026-08-27 | Card Orientation Metadata & Cache-First Art Resolution | **Accepted** | Model card orientation (Portrait vs Landscape for Schemes), responsive UI dimensions, and cache-first MarvelCDB card art loading. |
| [ADR-0012](0012-z-axis-hover-zoom-and-layering.md) | 2026-08-27 | Z-Axis Unconstrained Elevation & Hover-Zoom Architecture | **Accepted** | Maintain unconstrained Z-axis elevation (`z-50`) without overflow clipping or scrollbar spawning on interactive card docks. |
| [ADR-0013](0013-game-settings-and-dev-mode.md) | 2026-08-27 | Game Settings & Developer Mode State Architecture | **Accepted** | Decouple UI settings into a persistent React Context with a top-bar Dev Mode indicator and Options Menu. |
| [ADR-0014](0014-marvelcdb-deck-schema-and-metadata-decks.md) | 2026-08-27 | MarvelCDB-Compliant Deck Data Schema & Metadata-Driven Decks | **Accepted** | Standardize on official MarvelCDB JSON schema (`slots`, `hero_code`, `meta`) for 100% data-driven deck management without code coupling. |
| [ADR-0015](0015-user-content-and-deck-storage-architecture.md) | 2026-08-27 | User Content & Deck Storage Architecture | **Accepted** | Establish segmented storage hierarchy (`prebuilt_decks/`, `decks/`, `marvelcdb/`, `fan_made_heroes/`, `fan_made_scenarios/`) with cross-environment driver. |
| [ADR-0016](0016-one-file-per-deck-and-collision-safe-naming.md) | 2026-08-27 | 1-File-Per-Deck Storage Strategy & Collision-Resistant Naming | **Accepted** | Adopt 1 file per deck with domain-namespaced semantic slugs (`<pack>_<hero>_<aspect>.json`, `mcdb_<id>_<slug>.json`, `user_<hero>_<slug>_<id>.json`). |
| [ADR-0017](0017-panoramic-horizontal-tabletop-and-edge-scrolling.md) | 2026-08-27 | Panoramic Horizontal Tabletop with Edge and Drag Scrolling | **Accepted** | Panoramic horizontal row for 1–4 heroes with full-sized tableaus/hands, edge-hover auto-panning, and drag-to-scroll cross-table deployment. |

---

## Adding a New Decision
To propose or record a new decision:
1. Copy [`template.md`](template.md) to a new file named `XXXX-short-title.md`.
2. Fill in all sections thoroughly, especially the **Why / Rationale** and **Tradeoffs**.
3. Add an entry to the log table above.
