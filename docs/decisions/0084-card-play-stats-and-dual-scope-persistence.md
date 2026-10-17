# [ADR-0084] Card Play Stats and Dual-Scope Persistence Architecture

- **Status:** Accepted
- **Date:** 2026-10-17
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity
- **Related Issues:** [Issue #315](https://github.com/SteveRodrigue/MCD/issues/315)

---

## Context and Problem Statement

During development, simulation, and manual tabletop play, developers and players need clear visibility into which cards have been played, which abilities have been executed, and which basic actions were performed (across heroes, alter-egos, allies, villains, and minions). These statistics:

1. Identify untested cards and dormant abilities during development.
2. Scaffold future analytics, including per-card win/loss rates.
3. Must track usage both **per game** and **all-time**.

The challenge is supporting persistent, cross-game statistics without violating the core architectural constraint of a headless, decoupled rules engine (ADR-0002) and without cluttering git revision control with developer-specific play histories.

---

## Decision Drivers

- **Headless Decoupling (ADR-0002):** The rules engine must remain 100% headless, pure, and deterministic. It must not perform file I/O, access browser storage, or depend on React/DOM.
- **Git Hygiene:** Local play counts vary per developer and match run; committing them to the repository would generate continuous git noise and merge conflicts.
- **Accurate Counting Across Re-renders:** In React, components re-render frequently, and players may refresh or reload games. All-time persistence must never double-count actions across re-renders or page reloads.
- **DevMode Guardrails:** Destructive operations (resetting card or global stats) must be strictly safeguarded to prevent accidental data loss.
- **Extensibility:** The stats model must be indexed by generic string card codes and ability IDs to support custom content and expansions without schema alterations.

---

## Considered Options

1. **Option 1: Direct File/Storage Writes from Engine Pipeline:** Inject a storage adapter into the engine pipeline that writes directly to disk or `localStorage` on each action.
2. **Option 2: Pure LocalStorage in Browser Only:** Keep stats strictly in browser `localStorage`, with no file persistence or headless accessibility.
3. **Option 3: Dual-Scope Architecture with Session Delta Synchronization (Chosen):**
   - **Per-Game Scope:** Purely in-memory `state.stats: GameStats` on `GameState`, mutated deterministically by the engine pipeline.
   - **All-Time Scope:** Stored outside git in `stats/card_play_stats.json` (git-ignored) via a Vite middleware plugin (`cardStatsPlugin()`) with offline `localStorage` fallback.
   - **Delta Sync:** The UI storage service computes and pushes only session deltas to avoid re-render double-counting.

---

## Decision Outcome

**Chosen Option:** **Option 3: Dual-Scope Architecture with Session Delta Synchronization**

### Rationale ("The Why")

1. **Preserves Headless Invariants:** `src/engine/` remains completely headless, pure, and serializable. Tests and headless simulations (`scripts/simulate-games.ts`) can inspect `state.stats` directly with zero mocking of storage layers.
2. **Clean Git Hygiene:** Storing persistent data in `stats/card_play_stats.json` (git-ignored) ensures zero repository bloat, while the Vite plugin automatically initializes the folder and file on first launch.
3. **Idempotent Session Delta Sync:** `stats-storage-service.ts` keeps the last synced stats as a baseline, reset when a new game starts. When `gameState.stats` increments, only the positive delta is added to the persistent all-time store. The baseline advances before the request is sent, so accumulation stays exact regardless of React rendering frequency or overlapping syncs.
4. **DevMode Safety:** Single-card resets in `CardContextMenu` and all-time resets in `OptionsMenu` are strictly guarded behind `devMode` checks and explicit confirmation modals.

---

## Consequences

### Positive Consequences

- Rules engine remains 100% pure TypeScript without side-effects or platform dependencies.
- Zero git merge conflicts from local stats files.
- Works offline in static deployments via graceful `localStorage` fallback.
- Extensible: custom cards and modular encounter sets work immediately without configuration.

### Negative Consequences / Risks & Mitigations

- In offline/static builds where the Vite server is absent, all-time stats persist in `localStorage` rather than the JSON file. Mitigated by seamless fallback in `stats-storage-service.ts`.
