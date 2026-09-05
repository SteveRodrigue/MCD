# [ADR-0045] Card Supplemental Editor & Live Data Reviewer GUI

- **Status:** Accepted
- **Date:** 2026-09-05
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

The Marvel Champions Digital engine adheres to the **Declarative Data-First Invariant** (ADR-0021, ADR-0025, ADR-0043): card rules, abilities, timings, costs, and effects reside in declarative JSON files (`src/data/supplemental/pack/*.json`) validated against an authoritative Zod schema (`src/data/supplemental/schema.ts`).

Currently, reviewing and enriching card supplemental data is a manual, text-file-driven process:
1. Developers and card contributors must cross-reference raw upstream data (`data/upstream/pack/*.json`, `packs.json`, `sets.json`, `factions.json`) with supplemental files in a code editor.
2. Verifying whether a card has a valid supplemental definition, missing abilities, or schema errors requires running CLI audit tools (`npm run report:declarations` or `npm test`).
3. While playing or testing a game in the browser UI, if a developer spots a card behavior bug, they must leave the browser, locate the card code across hundreds of entries, edit JSON by hand, and run manual verification commands.

We need a dedicated, integrated **Card Supplemental Editor & Live Reviewer GUI** that enables developers to:
- Filter and browse cards across packs, encounter sets, hero sets, and aspect affinities.
- Compare printed card text and raw Zzorba upstream metadata side-by-side with declarative supplemental JSON.
- Edit supplemental abilities and metadata directly in the browser with real-time schema validation.
- Save changes directly to the filesystem with automated audit trail updates.
- Right-click any active card on the tabletop during gameplay to immediately inspect and edit it in a new window/tab.
- Reload card data seamlessly in the application.

---

## Decision Drivers

- **Developer Ergonomics & Verification Velocity:** Provide instant visual inspection of all cards across the 170+ pack catalog, eliminating manual cross-referencing between separate JSON files.
- **Data Integrity & Codebase-Grounded Validation:** Prevent saving invalid JSON or unsupported effect primitives by running `CardEnrichmentSchema` Zod validation live in the browser and backend.
- **In-Game Debugging Ergonomics:** Allow 1-click transition from an active game board into the card's supplemental definition via a context menu.
- **Local-First Architecture:** Avoid running separate backend server processes; integrate REST endpoints directly into Vite's existing dev server middleware (`vite.config.ts`).
- **Rhino Milestone Acceleration:** Completing this tooling before the final Gate 1 Rhino release will drastically reduce the time needed to review, refine, and verify the remaining Core Set player and encounter cards.

---

## Considered Options

1. **Option 1: Vite Dev Server REST Middleware + React Dual Inspector (Recommended)**
   - Add local dev middleware (`/api/supplemental/*`) directly into `vite.config.ts`.
   - Build a standalone React review/editor workspace (`/editor` route) within the existing React app.
   - Use existing `CardView` and comic theme for visual parity.
   - Add a right-click context menu on all tabletop cards linking to `/editor?code=<cardCode>`.

2. **Option 2: Standalone Electron / Desktop App**
   - Build an independent Electron or Tauri desktop utility communicating with the filesystem.
   - Requires packaging a separate runtime, managing desktop IPC, and duplicating card rendering components.

3. **Option 3: VS Code Webview Extension**
   - Implement a custom VS Code editor extension to edit `src/data/supplemental/pack/*.json`.
   - Cannot be launched directly from a right-click inside the running browser game, and tightly couples development to VS Code.

---

## Decision Outcome

**Chosen Option:** **Option 1: Vite Dev Server REST Middleware + React Dual Inspector**

### Rationale ("The Why")

- **Zero Additional Tooling Footprint:** MCD already runs a Vite dev server (`npm run dev`) with custom dev plugins (`cardCachePlugin`, `gameStateSnapshotPlugin`, `problemReportPlugin`). Extending this with a `cardSupplementalEditorPlugin()` requires zero new dependencies or separate server processes.
- **Direct Code Sharing:** The React UI can directly import `CardEnrichmentSchema` from `src/data/supplemental/schema.ts`, `cardCatalog` from `src/data/importer/card-loader.ts`, and the comic UI design tokens (`CardView`, `FormattedCardText`, Bangers typography, Ben-Day halftone styling).
- **Frictionless In-Game Context Menu:** A simple `window.open('/editor?code=' + card.code, '_blank')` enables instant right-click debugging from any card in play without interrupting the player's desktop workflow.
- **Safe Hot-Reload Contract:** Changes saved to disk update the JSON files directly. Vite HMR detects the file change and reloads the modules. We explicitly accept that hot-reloading mid-game may terminate or desynchronize an active session.

---

## Evaluation of Options

### Option 1: Vite Dev Server REST Middleware + React Dual Inspector
- **Pros:**
  - Zero extra installation or runtime dependencies; works out of the box with `npm run dev`.
  - Reuses existing React components (`CardView`, `FormattedCardText`) and Zod validation schemas directly.
  - Seamless in-game context menu integration via browser standard window management (`window.open`).
  - Automatically updates audit metadata (`updatedAt`, `reviewedBy`, `confidence`) and runs declaration analyzer checks on save.
- **Cons:**
  - Dev-only feature (not available in static production builds, which is intended for development tooling).

### Option 2: Standalone Electron / Desktop App
- **Pros:**
  - Native filesystem access without browser sandbox.
- **Cons:**
  - High maintenance overhead; requires separate build pipeline, desktop dependencies, and component duplication.
  - Cannot be cleanly launched from an in-game right-click without OS-level URI schemes.

### Option 3: VS Code Webview Extension
- **Pros:**
  - Integrated inside the code editor.
- **Cons:**
  - Decoupled from the running game board; cannot support in-game right-click launch.
  - Restricted webview execution environment with complex message passing.

---

## Consequences

### Positive Consequences

- **10x Faster Card Audits:** Reviewers can visually inspect printed card text, raw upstream attributes, and supplemental ability trees side-by-side in seconds.
- **Instant In-Game Triage:** Spotting unexpected behavior during gameplay immediately points developers to the exact card declaration with 1 right-click.
- **Guaranteed Schema Conformance:** Form and JSON editors enforce live Zod validation before permitting disk saves.
- **Automated Audit Stamping:** Edits automatically record ISO timestamps (`updatedAt`, `reviewedAt`) and user attribution, enforcing Card Integration Protocol compliance.

### Negative Consequences / Risks & Mitigations

- **Risk: Game Desynchronization on Hot-Reload:** Modifying card definitions while a game is actively running may invalidate state invariants or trigger react component remounts.
  - **Mitigation:** The user explicitly accepted this trade-off. The editor and context menu will clearly display a toast/warning: *"Saving will hot-reload card data and may restart or terminate active games."*
- **Risk: Malformed Disk Writes:** Invalid JSON or corrupted schemas written to disk could break the dev server or test suite.
  - **Mitigation:** The REST API backend runs `CardEnrichmentSchema.safeParse()` prior to disk write, rejecting invalid payloads with detailed HTTP 400 error diagnostics.
