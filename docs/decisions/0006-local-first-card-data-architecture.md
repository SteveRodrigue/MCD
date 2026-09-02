# [ADR-0006] Local-First Card Data Architecture with Layered Overrides & Controlled Sync

- **Status:** Accepted
- **Date:** 2026-08-26
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

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
2. **Strict Read-Only Immutability for Upstream Data:** Upstream `zzorba/marvelsdb-json-data` is treated as a **strictly READ-ONLY** reference snapshot. MCD application code, importers, and engine logic must **NEVER** write to, mutate, or alter upstream files.
3. **Layered Supplementation System:** Any errata, missing metadata, rules corrections, or engine effect hooks MUST be placed exclusively in `src/data/supplemental/`.[^layers]
4. **Immutability & Stability:** Upstream changes must NEVER automatically alter or break production code. Syncing from upstream is an explicit, opt-in development task.
5. **Automated Validation on Sync:** Any sync from upstream must pass schema validation and test recursion before being accepted.

---

## Architecture: The 3-Layer Data Pipeline

```
+-----------------------------------------------------------------------------------+
|  1. Upstream Raw Layer (data/upstream/) [STRICTLY READ-ONLY]                      |
|     - Exact local mirror of zzorba/marvelsdb-json-data (packs, cards, locales)    |
|     - NEVER modified or written to by MCD code. Read-only reference snapshot.     |
|     - Updated ONLY via the explicit manual sync below. Never at runtime.          |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v  [Read-Only Stream]
+-----------------------------------------------------------------------------------+
|  2. Supplemental Layer (src/data/supplemental/)                                   |
|     - Engine effect hooks (timings, steps, costs, target filters)                 |
|     - Official FFG Errata overrides & missing metadata                            |
|     - Custom / homebrew card sets                                                 |
|     - Zod-validated (schema.ts) in CI per ADR-0022                                |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v  [Assembled at load time]
+-----------------------------------------------------------------------------------+
|  3. Normalized Card Catalog (in-memory, src/data/card-loader.ts + importer/)      |
|     - NOT a checked-in directory. The engine assembles the catalog on the fly by  |
|       joining upstream card records with their supplemental enrichment by code.   |
|     - Verified by automated unit tests in tests/data/                             |
+-----------------------------------------------------------------------------------+
```

[^layers]: **Errata (2026-09-02, `documentation-audit`).** This ADR originally described a separate `src/data/overrides/` directory and a checked-in `src/data/cards/` catalog. Neither exists, and neither is planned: overrides live directly in `src/data/supplemental/`, and the normalized catalog is built **in memory at load time** rather than persisted. The layered intent of the decision is unchanged — only the physical layout is corrected here.

---

## Controlled Sync Workflow

> [!IMPORTANT]
> **`zzorba/marvelsdb-json-data` is the canonical source for all official Marvel Champions card
> metadata.** Fan-made and homebrew content is the only category authored outside it. Syncing is
> **always a deliberate, reviewed development task** — never automatic, never at runtime.

### How to sync / re-sync

Run the sync script from the repository root:

```powershell
pwsh scripts/sync_data.ps1
```

The script ([`scripts/sync_data.ps1`](../../scripts/sync_data.ps1)) downloads
`https://github.com/zzorba/marvelsdb-json-data/archive/refs/heads/master.zip`, extracts it to a temp
folder, and copies the contents over `data/upstream/`. It **overwrites** that directory in place and
does not delete files that upstream has removed — inspect `git status` after every run.

### Mandatory post-sync verification

A sync is not complete until all of the following pass:

```bash
npm test                    # full regression suite
npm run typecheck           # zero TypeScript errors
npm run report:declarations # zero schema violations; diff the report
```

Only when 100% pass may the updated `data/upstream/` be committed.

> [!WARNING]
> **Any upstream pull can break cards.** `data/upstream/` is a third-party dataset that MCD does not
> control. A sync may introduce:
>
> - **Structural changes** — renamed or restructured JSON fields, changed pack/set file layout.
> - **New or removed parameters** — fields our importer does not read, or fields it depends on that vanish.
> - **Changed values** — corrected card text, renamed cards, altered stats, or **reassigned card codes**.
>
> Because `src/data/supplemental/` joins to upstream **by card code**, a code or field change can
> silently orphan an enrichment: the card still loads, but its abilities stop firing. Treat a red
> test suite, a changed card count, or a new entry in the declarations report's orphan list as a
> **blocking** signal, and reconcile the supplemental layer before committing. Never "fix" a sync by
> editing `data/upstream/` — that layer is strictly read-only.

---

## Consequences

### Positive Consequences

- The game is 100% offline, self-contained, and ultra-fast (zero network latency for card data).
- Zero risk of upstream changes breaking active game sessions or tests, because upstream only ever changes during a deliberate, verified sync.
- Clean separation between raw community metadata and game engine script logic.
- Easy to add new heroes, errata, or custom modular sets via the supplemental layer.

### Negative Consequences / Risks & Mitigations

- _Data duplication:_ A local copy of JSON files resides in the repository. _Mitigation:_ The total JSON dataset for Marvel Champions is only ~10MB, which is completely negligible for modern git repositories.
- _Upstream drift:_ MCD can fall behind `zzorba/marvelsdb-json-data`, and each catch-up sync carries the breakage risk described above. _Mitigation:_ Sync deliberately and infrequently, always as its own reviewable commit, gated on the full verification suite so any regression surfaces before merge.
- _Code-based coupling:_ The supplemental layer joins to upstream by card code, so an upstream code change orphans enrichment silently. _Mitigation:_ `npm run report:declarations` lists orphaned declarations; diff it on every sync.
