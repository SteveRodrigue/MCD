# [ADR-0014] MarvelCDB-Compliant Deck Data Schema & Metadata-Driven Decks

* **Status:** Accepted
* **Date:** 2026-08-27
* **Deciders:** Core Engineering Team
* **Consulted:** Open Source Contributors & Community Specifications
* **Informed:** MCD Maintainers

---

## Context & Problem Statement

In early development, starter decks (such as Spider-Man Justice) were partially assembled via hardcoded TypeScript arrays within `src/engine/decks/starter-decks.ts`. 

This posed two major architectural problems:
1. **Code Coupling:** Adding, balancing, or updating hero starter decks required writing TypeScript code and recompiling the application.
2. **Ecosystem Fragmentation:** The global *Marvel Champions: The Card Game* digital community universally relies on **[MarvelCDB](https://marvelcdb.com)** as the single source of truth for deckbuilding, sharing, and decklist storage. If MCD invented a proprietary deck format, community decks would require ongoing translation layers, increasing bug potential and friction for future features (e.g. *1-click MarvelCDB URL Import* and the *In-Game Deckbuilder*).

We needed a clean, 100% data-driven deck architecture that allows adding unlimited decks via metadata while remaining 100% natively compatible with the MarvelCDB ecosystem.

---

## Decision Drivers

* **Zero-Code Deck Extensibility:** Adding new prebuilt or custom decks must require only adding a JSON entry in `data/decks/`—never modifying TypeScript engine code.
* **Direct MarvelCDB API Compatibility:** The internal deck representation must mirror the canonical MarvelCDB Deck JSON schema (`hero_code`, `slots: Record<string, number>`, `meta: string | object`, `description_md`, `tags`, etc.).
* **Deterministic Resolution:** A single generic loader must resolve any valid MarvelCDB deck object against the `CardCatalog` to assemble the Hero/Alter-Ego identity, the 40–50 card draw deck, the associated Obligation card, and the 5-card set-aside Nemesis set.
* **Multi-Hero Flexibility:** Allow 1 to 4 players in Solo Multi-Seat mode to freely assign any available deck to any seat.

---

## Considered Options

### Option 1: Proprietary MCD Custom Deck JSON Schema
* Define an internal custom JSON format (e.g. `{ hero: "spider_man", cards: ["01002", "01003"] }`).
* *Cons:* Requires writing bespoke import/export adapters for MarvelCDB, OCTGN, and other community tools. High maintenance cost when community deck conventions evolve.

### Option 2: Hardcoded TypeScript Starter Deck Factories
* Keep starter deck definitions in code using programmatic array filters (`catalog.getCardsByFaction('justice')`).
* *Cons:* Not data-driven; impossible for non-developer contributors to add decks; impossible to serialize/deserialize custom player-built decks.

### Option 3 (Selected): Standard MarvelCDB Public Deck Schema (`MarvelCDBDeck`) + JSON Repository
* Standardize on MarvelCDB's public API deck data structure as the first-class deck model in `@engine/models/deck.ts`.
* Store vanilla starter decks in `data/decks/starter_decks.json` replicating MarvelCDB's canonical Decklists `#1` through `#5`.
* Implement a generic, decoupled loader `loadDeckFromMarvelCDB(deck, catalog)` in `@engine/decks/starter-decks.ts`.

---

## Decision Outcome

**Chosen Option: Option 3 (Standard MarvelCDB Public Deck Schema + JSON Repository).**

### 1. Data Model Definition (`src/engine/models/deck.ts`)
```typescript
export interface MarvelCDBDeck {
  id: number | string;
  name: string;
  hero_code: string;
  hero_name: string;
  slots: Record<string, number>;            // Card code to quantity mapping
  ignoreDeckLimitSlots?: Record<string, number> | null;
  sideSlots?: Record<string, number> | null;
  meta?: string | MarvelCDBDeckMeta | null; // e.g. {"aspect":"justice"}
  description_md?: string;
  date_creation?: string;
  date_update?: string;
  user_id?: number | null;
  version?: string;
  tags?: string;
}

export interface MarvelCDBDeckMeta {
  aspect?: string;
  aspect_name?: string;
  extra_hero_cards?: string[];
  [key: string]: any;
}
```

### 2. Vanilla Core Set Decks Repository (`data/decks/starter_decks.json`)
The five vanilla starter decks are stored as exact replicas of MarvelCDB public decklists:
* **Decklist #1:** *Black Panther - Protection - Starter Deck* (`01040a`, 40 cards)
* **Decklist #2:** *Captain Marvel - Leadership - Starter Deck* (`01010a`, 40 cards)
* **Decklist #3:** *She-Hulk - Aggression - Starter Deck* (`01019a`, 40 cards)
* **Decklist #4:** *Iron Man - Aggression - Starter Deck* (`01029a`, 40 cards)
* **Decklist #5:** *Spider-Man - Justice - Starter Deck* (`01001a`, 40 cards)

### 3. Generic Deck Loader Pipeline (`src/engine/decks/starter-decks.ts`)
The loader dynamically executes the following resolution steps:
1. **Hero Identity:** Resolves `hero` card by `deck.hero_code`. Resolves `alterEgo` card via `hero.backLink` or matching set code.
2. **Player Draw Deck:** Expands the key-value `slots` map into the exact 40–50 normalized card instances.
3. **Obligation Resolution:** Automatically queries the catalog for the hero's Obligation card (`type === 'obligation'` matching hero set/text) to shuffle into the scenario encounter deck during setup.
4. **Nemesis Isolation:** Automatically queries the catalog for the 5-card Nemesis Set (`${hero.setCode}_nemesis`) to isolate out of play.

---

## Consequences

### Positive Impacts
* **Zero Code Changes for New Decks:** Any contributor can add a new prebuilt deck simply by dropping a MarvelCDB JSON object into `data/decks/starter_decks.json`.
* **Plug-and-Play MarvelCDB Integration:** Future features like *"Import Deck by MarvelCDB URL / ID"* require zero translation—the HTTP response body directly feeds into `loadDeckFromMarvelCDB()`.
* **Deckbuilder Ready:** When the Phase 4 in-game deckbuilder is built, exporting custom decks will natively produce valid MarvelCDB JSON files ready for sharing.
* **Complete Core Set Roster:** All 5 vanilla heroes (*Spider-Man*, *Captain Marvel*, *She-Hulk*, *Iron Man*, *Black Panther*) are immediately playable across 1–4 seats.

### Tradeoffs & Considerations
* **Slot Code Validation:** The deck loader must strictly validate that every card code in `slots` exists in `CardCatalog`. If an unknown card code is encountered (e.g. from an unreleased expansion), the loader throws a descriptive validation error.

---

## References & Citations

* **MarvelCDB Public API Specification:** `https://marvelcdb.com/api/doc`
* **MarvelCDB Canonical Decklists:** `https://marvelcdb.com/api/public/decklist/{1..5}`
* **MCD Architecture Decision Records:**
  * [ADR-0002: Decoupled Headless Rules Engine](0002-decoupled-headless-rules-engine.md)
  * [ADR-0006: Local-First Card Data Architecture](0006-local-first-card-data-architecture.md)
  * [ADR-0010: Scenario Catalog & Multi-Hero Setup Architecture](0010-scenario-catalog-and-multi-hero-setup.md)
