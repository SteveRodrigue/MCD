# [ADR-0006] Local-First Card Data Architecture with Layered Overrides & Controlled Sync

* **Status:** Accepted
* **Date:** 2026-08-26
* **Authors:** MCD Core Team
* **Deciders:** User & Antigravity

---

## Context and Problem Statement
Marvel Champions card metadata is publicly maintained in `zzorba/marvelsdb-json-data`. Relying on dynamic, runtime network requests to external repositories introduces fragility:
1. Upstream typos, schema migrations, or unreviewed changes could break our rules engine.
2. Offline play and deterministic automated testing would be impossible without internet access.
3. Upstream MarvelsDB JSON contains raw card text and stats, but lacks execution hooks for our game engine (e.g. trigger functions, target filters, replacement handlers).

We need a robust, local-first data architecture that keeps all data locally versioned, supports controlled upstream syncing, and allows custom game engine metadata to supplement or supersede upstream data.

---

## Decision Drivers
1. **100% Local & Offline Reliability:** All card data must be bundled directly in the codebase. The game engine and test suite must run 100% offline.
2. **Immutability & Stability:** Upstream changes must NEVER automatically alter or break production code. Syncing from upstream is an explicit, opt-in development task.
3. **Layered Override & Supplementation System:** Ability to enrich or override upstream card properties (e.g. adding engine effect handlers, custom fan content, or official FFG rules errata) without mutating upstream raw files.
4. **Automated Validation on Sync:** Any sync from upstream must pass schema validation and test recursion before being accepted.

---

## Architecture: The 3-Layer Data Pipeline

```
+-----------------------------------------------------------------------------------+
|  1. Upstream Raw Layer (data/upstream/)                                           |
|     - Local snapshot of zzorba/marvelsdb-json-data (packs, cards, translations)   |
|     - Updated ONLY via explicit manual command: `npm run data:sync`               |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|  2. Supplemental & Override Layer (src/data/overrides/ & src/data/supplemental/)  |
|     - Engine effect hooks (trigger conditions, payment logic, target filters)     |
|     - Official FFG Errata overrides & missing metadata                            |
|     - Custom / homebrew card sets                                                 |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v  [Merge & Validate via TypeScript]
+-----------------------------------------------------------------------------------+
|  3. Normalized Card Catalog (src/data/cards/)                                     |
|     - Typed, validated, and optimized card catalog used by the engine & UI        |
|     - Verified by automated unit tests in tests/data/                             |
+-----------------------------------------------------------------------------------+
```

---

## Controlled Sync Workflow

1. **Developer executes sync script:**
   ```bash
   npm run data:sync
   ```
2. **The script pulls upstream JSON snapshots into `data/upstream/`.**
3. **The compiler merges upstream data with local overrides and validates against TypeScript schemas.**
4. **Vitest runs the full regression test suite (`npm test`).**
5. **Only if 100% of tests pass**, the updated data is committed to git.

---

## Consequences

### Positive Consequences
* The game is 100% offline, self-contained, and ultra-fast (zero network latency for card data).
* Zero risk of upstream changes breaking active game sessions or tests.
* Clean separation between raw community metadata and game engine script logic.
* Easy to add new heroes, errata, or custom modular sets via the overrides layer.

### Negative Consequences / Risks & Mitigations
* *Data duplication:* A local copy of JSON files resides in the repository. *Mitigation:* The total JSON dataset for Marvel Champions is only ~10MB, which is completely negligible for modern git repositories.
