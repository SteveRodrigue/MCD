# [ADR-0015] User Content & Deck Storage Architecture (Prebuilt, Custom, MarvelCDB, Fan-Made)

* **Status:** Accepted
* **Date:** 2026-08-27
* **Deciders:** Core Engineering Team & Project Maintainer
* **Consulted:** Open Source Contributors & Community Modding Standards
* **Informed:** MCD Community

---

## Context & Problem Statement

As **Marvel Champions Digital (MCD)** expands beyond the core introductory matchups, the application needs to store and manage multiple categories of content with distinct lifecycles, permissions, and origins:

1. **Prebuilt Core/Expansion Decks:** Official curated starter decks shipped with the codebase (e.g. the 5 Core Set starter decks).
2. **User-Created Decks:** Custom decks created, edited, and saved by players in the upcoming In-Game Deckbuilder.
3. **Imported MarvelCDB Decks:** Decks fetched on-demand from `https://marvelcdb.com/api/` via URL or decklist ID, intended as read-only references (or cloned to custom).
4. **Fan-Made Heroes & Custom Cards:** Community-created hero packages (custom identity, 15 signature cards, custom artwork, and nemesis sets).
5. **Fan-Made Scenarios & Modulars:** Community-created villains, main schemes, side schemes, and encounter packs.

Furthermore, MCD is designed to run in two target environments:
* **Web Browser (Vite SPA):** Sandboxed client environment without direct OS filesystem access (relies on browser storage: `IndexedDB` / `localStorage` / File System Access API).
* **Native Desktop (Tauri):** Desktop executable with native access to the user's OS application data directory (`%APPDATA%/MCD/` or `~/.config/mcd/`).

We need a unified, well-structured content architecture that organizes these content streams cleanly and abstracts storage differences across web and desktop.

---

## Decision Drivers

* **Explicit Separation of Concerns:** Distinguish clearly between immutable bundled game assets, read-only cached third-party imports, and mutable user-generated content.
* **Modding & Fan-Made Support:** Establish a clear folder convention for community-created custom heroes and custom scenarios from the ground up.
* **Cross-Environment Compatibility:** The same content hierarchy and query APIs must work identically in both the Browser (using `IndexedDB`) and Desktop (using native file system folders).
* **Immutability & Safety:** Prebuilt official decks and third-party MarvelCDB snapshots must be protected from accidental in-place corruption (users can clone them to edit).

---

## Considered Options

### Option 1: Monolithic Flat Key-Value Store
* Store all decks and custom content in a single flat store or directory, differentiated only by a `type` tag in each JSON object.
* *Cons:* Lacks organization on disk for desktop users and modders; difficult to browse, backup, or drop custom `.json` files manually into folders.

### Option 2 (Proposed): Segmented Directory Hierarchy + Pluggable Storage Driver (`IContentStorage`)
* Establish a standardized directory structure with dedicated subfolders per content domain:
  * `prebuilt_decks/`
  * `decks/`
  * `marvelcdb/`
  * `fan_made_heroes/`
  * `fan_made_scenarios/`
* Implement a pluggable `IContentStorageDriver` abstraction:
  * `FileSystemStorageDriver` (for Tauri native desktop).
  * `IndexedDbStorageDriver` (for browser web client).
  * `BundledStorageDriver` (for read-only core assets bundled at build time).

---

## Decision Outcome

**Chosen Direction: Option 2 (Segmented Directory Hierarchy + Pluggable Storage Driver).**

### 1. Standard Content Directory Hierarchy

```
data/ (or User Data Directory in Desktop / Virtual Folders in Web)
├── prebuilt_decks/         # 🔒 Built-in canonical decks shipped with MCD (Core 5, etc.) [Read-Only]
├── decks/                  # ✏️ User-created custom decks saved in-game [Read/Write]
├── marvelcdb/              # 📥 Decks imported from MarvelCDB API/URLs [Read-Only Cache / Cloneable]
├── fan_made_heroes/        # 🦸 User-uploaded / community custom hero packages [Read/Write]
└── fan_made_scenarios/     # 🦹 User-uploaded / community custom scenarios & modulars [Read/Write]
```

### 2. Permissions & Lifecycle Rules

| Directory | Origin / Purpose | Modifiable? | Format |
| :--- | :--- | :--- | :--- |
| **`prebuilt_decks/`** | Bundled with MCD release (Core Set & official expansions). | ❌ Read-Only (Clone to edit) | `MarvelCDBDeck` JSON |
| **`decks/`** | Built by player in the MCD Deckbuilder. | ✅ Full Read / Write / Delete | `MarvelCDBDeck` JSON |
| **`marvelcdb/`** | Fetched via MarvelCDB Public API / URL import. | 🔒 Cached Read-Only snapshot | `MarvelCDBDeck` JSON |
| **`fan_made_heroes/`** | Community custom hero packages (cards + images). | ✅ Full Read / Write / Import | Hero Package JSON / Folder |
| **`fan_made_scenarios/`** | Community custom villains, schemes & modular sets. | ✅ Full Read / Write / Import | Scenario Package JSON / Folder |

### 3. Unified Storage Driver Interface (`IContentStorageDriver`)

```typescript
export interface IContentStorageDriver {
  // Decks
  getPrebuiltDecks(): Promise<MarvelCDBDeck[]>;
  getUserDecks(): Promise<MarvelCDBDeck[]>;
  saveUserDeck(deck: MarvelCDBDeck): Promise<void>;
  deleteUserDeck(deckId: string | number): Promise<void>;
  
  // MarvelCDB Imports
  getMarvelCDBDecks(): Promise<MarvelCDBDeck[]>;
  saveMarvelCDBDeck(deck: MarvelCDBDeck): Promise<void>;

  // Fan-Made Content
  getFanMadeHeroes(): Promise<CustomHeroPackage[]>;
  saveFanMadeHero(heroPkg: CustomHeroPackage): Promise<void>;
  getFanMadeScenarios(): Promise<CustomScenarioPackage[]>;
  saveFanMadeScenario(scenarioPkg: CustomScenarioPackage): Promise<void>;
}
```

---

## Consequences

### Positive Impacts
* **Clean User Experience:** Modders on Desktop (Tauri) can simply drop custom hero or scenario JSON files directly into their OS `fan_made_heroes/` folder to play them in-game.
* **Seamless Web Experience:** Browser users get the exact same functionality via `IndexedDB` with file export/import dialogs.
* **Integrity & Safety:** Official starter decks (`prebuilt_decks/`) cannot be accidentally overwritten or corrupted.
* **MarvelCDB Parity:** Preserves exact original snapshots of imported MarvelCDB decklists in `marvelcdb/` while allowing users to clone them to `decks/` for modifications.

### Tradeoffs & Considerations
* **Asset Bundling (Images):** Fan-made heroes and scenarios may include custom card art. The fan content schema will support embedding base64 image data or referencing local asset paths.

---

## References

* [ADR-0003: Technology Stack Selection (TypeScript/React/Tauri)](0003-technology-stack-selection.md)
* [ADR-0006: Local-First Card Data Architecture](0006-local-first-card-data-architecture.md)
* [ADR-0014: MarvelCDB-Compliant Deck Data Schema & Metadata-Driven Decks](0014-marvelcdb-deck-schema-and-metadata-decks.md)
