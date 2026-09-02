# [ADR-0016] 1-File-Per-Deck Storage Strategy & Collision-Resistant Naming

* **Status:** Accepted (Option 3 Approved by Project Maintainer)
* **Date:** 2026-08-27
* **Deciders:** Core Engineering Team & Project Maintainer
* **Consulted:** Open Source Contributors & Filesystem Modding Guidelines
* **Informed:** MCD Community

---

## Context & Problem Statement

In [ADR-0014](0014-marvelcdb-deck-schema-and-metadata-decks.md) and [ADR-0015](0015-user-content-and-deck-storage-architecture.md), we standardized on the official **MarvelCDB JSON deck schema** and established segmented content directories (`prebuilt_decks/`, `decks/`, `marvelcdb/`).

However, storing multiple decks inside a single monolithic file (e.g. `data/prebuilt_decks/starter_decks.json` containing an array of 5 decks) presents significant friction:
1. **Version Control & Merge Conflicts:** Multiple contributors adding new hero decks to a single JSON array causes Git merge conflicts.
2. **File Modularity:** Users and modders cannot simply share, drop, delete, or organize individual deck files in their file explorer.
3. **Collision Risk Across Sources:** When individual files are used across multiple folders (`prebuilt_decks/`, `decks/`, `marvelcdb/`), we need a standard filename convention that avoids collisions (e.g., users naming two decks identically, or importing a MarvelCDB deck with special characters forbidden by Windows filesystems).

We need to establish:
1. A **1-file-per-deck** storage standard.
2. A **collision-resistant, cross-platform filesystem-safe** naming convention.

---

## Decision Drivers

* **1-to-1 File Modularity:** Every deck is an independent `.json` file containing a single `MarvelCDBDeck` object.
* **Cross-Platform Filesystem Safety:** Filenames must use only ASCII alphanumeric characters, hyphens, and underscores (safe across Windows, macOS, and Linux; no invalid characters like `:`, `?`, `*`, `"`, `/`, `\`).
* **Zero Collisions:** 
  * Same deck imported twice from MarvelCDB should overwrite cleanly (idempotent).
  * Two user decks with the exact same display name must never overwrite each other.
* **Human Readability:** A developer or player browsing the folder in VS Code or Windows Explorer should immediately recognize the hero, aspect, and name from the filename.

---

## Considered Options

### Option 1: Pure UUID / ID Filenames (`<id>.json`)
* Examples: `d0df3581-aaa2-45b8-8ff1-fff25cf0a074.json`, `1.json`, `25431.json`
* *Pros:* Guaranteed unique; trivial to generate.
* *Cons:* Zero human legibility; impossible to know what deck a file represents without opening and parsing its JSON.

### Option 2: Pure Display Title Slug (`<title-slug>.json`)
* Examples: `spider-man-justice-starter.json`, `my-favorite-aggression-deck.json`
* *Pros:* Very readable.
* *Cons:* High collision risk. If a user makes two decks named "My Aggression Deck", the second silently overwrites the first. Also risk of name collision with official prebuilt decks.

### Option 3 (Recommended): Domain-Namespaced Prefix + Semantic Slug + ID Suffix
Adopt a standardized naming scheme per folder domain:

| Domain Directory | Filename Pattern | Example Filename |
| :--- | :--- | :--- |
| **`prebuilt_decks/`** | `<pack>_<hero_set>_<aspect>.json` | `core_spider_man_justice.json`<br/>`core_captain_marvel_leadership.json`<br/>`core_she_hulk_aggression.json`<br/>`core_iron_man_aggression.json`<br/>`core_black_panther_protection.json` |
| **`marvelcdb/`** | `mcdb_<decklist_id>_<slug>.json` | `mcdb_1_black-panther-protection.json`<br/>`mcdb_25431_shield-justice-spidey.json` |
| **`decks/` (User Custom)** | `user_<hero_set>_<slug>_<short_id>.json` | `user_spider_man_web-rush_a7f9.json`<br/>`user_iron_man_tech-mastery_3b2e.json` |

* *Pros:*
  * **100% Deterministic for Prebuilts & Imports:** Prebuilts and MarvelCDB imports have deterministic filenames (importing deck `#1` always updates `mcdb_1_...json`).
  * **Collision-Free for User Decks:** Adding a short 4-to-6 character nanoid/hash suffix (`a7f9`) ensures duplicate deck names never overwrite existing files.
  * **Maximal Human Legibility:** Clear hero set code, aspect, and name visible at a glance.

---

## Decision Outcome

**Chosen Option: Option 3 (Domain-Namespaced Prefix + Semantic Slug + ID Suffix with 1-File-Per-Deck) — Approved by Project Maintainer.**

### 1. Concrete Directory Layout

```
data/ (and Desktop User AppData)
├── prebuilt_decks/
│   ├── core_spider_man_justice.json
│   ├── core_captain_marvel_leadership.json
│   ├── core_she_hulk_aggression.json
│   ├── core_iron_man_aggression.json
│   └── core_black_panther_protection.json
├── decks/
│   └── (User-created decks generated as user_<hero>_<slug>_<short_id>.json)
├── marvelcdb/
│   └── (Imported MarvelCDB decks cached as mcdb_<id>_<slug>.json)
├── fan_made_heroes/
└── fan_made_scenarios/
```

### 2. File Content Format
Each individual file contains a single, valid `MarvelCDBDeck` JSON object:
```json
{
  "id": 1,
  "name": "Black Panther - Protection - Starter Deck",
  "hero_code": "01040a",
  "hero_name": "Black Panther",
  "slots": {
    "01041": 1,
    "01042": 1,
    "..."
  },
  "meta": "{\"aspect\":\"protection\"}",
  "description_md": "Suggested starter deck from the core set.",
  "version": "1.0",
  "tags": "beginner"
}
```

### 3. Automatic Prebuilt Deck Ingestion in Vite / Engine
Using Vite's `import.meta.glob` or static bundling:
```typescript
const prebuiltFiles = import.meta.glob('../../../data/prebuilt_decks/*.json', { eager: true });
```
Adding a new prebuilt deck in the future requires only creating a new `.json` file in `data/prebuilt_decks/` (e.g. `thor_aggression.json`). Vite and the engine loader will discover and register it automatically with zero code changes!

---

## Consequences

### Positive Impacts
* **Git Cleanliness:** Adding or modifying a starter deck touches only 1 isolated file with zero merge conflicts.
* **100% Modding Ergonomics:** Modders and users can drag-and-drop single deck files in Explorer or Finder.
* **Deterministic MarvelCDB Cache:** Re-importing a MarvelCDB deck updates its exact file without creating ghost duplicates.
* **Safe User Custom Decks:** Nano-ID suffixes prevent accidental file overwrites in the deckbuilder.

### Tradeoffs & Considerations
* **Slugification Utility:** MCD will include a lightweight, robust `slugify(name)` utility that strips diacritics and forbidden filesystem characters (`[\\/:*?"<>|]`).

---

## References

* [ADR-0014: MarvelCDB-Compliant Deck Data Schema & Metadata-Driven Decks](0014-marvelcdb-deck-schema-and-metadata-decks.md)
* [ADR-0015: User Content & Deck Storage Architecture](0015-user-content-and-deck-storage-architecture.md)
