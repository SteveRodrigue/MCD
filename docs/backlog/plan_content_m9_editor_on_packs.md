# Plan — M9: The Card Supplemental Editor edits packs, not the repository

**Status:** draft 2026-11-01, revised after Steve's answer to decision 1 (supplemental data must stay editable during development of the game and engine, so tracked packs are writable in dev; Q57). Waiting for review (open decisions in section 9).
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (Q7, Q24, Q27, Q55; roadmap row M9) and [ADR-0092](../decisions/0092-content-packs-and-runtime-loading.md) (decision 9).
**Depends on:** M3, M4, M7 (merged or in review). Independent of M10 (docs) and of the parked desktop app (#548).
**Gate note:** Gate 1 (Rhino) is active. M9 touches no engine file. Proof: seeded Rhino game and `simulate --no-stats` byte-identical, full suite green, and the browser check in section 7.

## In-Game Scenario

In-Game Scenario: none (authoring tool; the game plays the same).

**Authoring scenario (stands in for it):**
**Setup:** Steve has a fan pack `my-hero-pack` (origin `user`) in `content/packs/` with one hero card and no supplemental data. It is listed in `enabledPacks`. `npm run dev`, open `/editor`.
**Does:** Picks `my-hero-pack` in the pack list, selects the hero card, builds an ability in the form and presses Save. Then picks Core and edits a Core card the same way.
**Today:** The editor lists cards from one global pile read from disk by a dev-only API, and Save writes to whichever `content/packs/<id>/supplemental/<file>.json` matches the card, whatever the pack's origin. There is no notion of a user pack versus an official one, so a fan pack's file and a Core file are treated alike, and the editor cannot work without the Vite dev server's special `/api/supplemental` routes.
**After this change:** The pack list shows each enabled pack with its origin. For `my-hero-pack` Save writes `content/packs/my-hero-pack/supplemental/<file>.json` and the game sees the data after a reload. For Core, Save writes `content/packs/core/supplemental/<file>.json` in the working tree, so the change shows up in `git status` like any other edit. A pack the sync command downloaded (`official-sync`, not part of the repository) opens read-only with the note "Synced packs are re-downloaded; edit a copy". Cards, their saved status and validation errors come from the content the game already loaded, not from a second reader of the files.
**Why (rules):** None. This is about who may write which files (Q24), not about gameplay.

## 1. Goal

After M9 the editor reads what the loader loaded, writes only to packs this checkout owns (`user` and `official-bundled`) through one write path on the storage side, and the editor-specific API (`/api/supplemental/*`, `CardSupplementalService`) no longer exists.

## 2. Facts (verified 2026-11-01 on `main`)

- **The editor API:** `src/tools/editor/api-middleware.ts` (about 560 lines) reads `content/meta/*.json`, every pack's `cards/*.json` and `supplemental/*.json` from disk, filters, pages and validates on the server, and `saveCardSupplemental` writes `packs/<pack>/supplemental/<stem>.json`. `cardSupplementalEditorPlugin()` registers it for the dev server only. Routes: `GET /api/supplemental/packs`, `GET /api/supplemental/cards`, `GET /api/supplemental/card/:code`, `POST /api/supplemental/card/:code`.
- **The client:** `src/ui/services/supplemental-editor-service.ts` fetches those routes and imports **types** from the middleware (`CardSummary`, `PackMetadataResponse`, `CardDetailsResponse`). `SupplementalEditorScreen`, `CardFilterToolbar`, `CardGalleryList` and `DualCardInspector` use that service.
- **Tests:** `tests/tools/supplemental-editor-api.test.ts` (377 lines) tests the service class and the middleware; `tests/ui/supplemental-editor-service.test.ts` tests the client; four more UI tests render the editor components.
- **The storage side is read-only:** `ContentDriver` has `listFiles`, `listDirs`, `exists`, `readJson` and nothing that writes. `NodeFsDriver` and `FetchDriver` implement it. The dev content endpoint (`/__content/*`) is read-only and serves only the JSON files in its index.
- **Loaded content already has what the editor lists:** `getLoadedContent()` holds, per enabled pack, raw cards, merged supplemental data, `manifest.origin` and (since M7) a description with state. The editor only needs `content/meta/*.json` (factions, sets, pack names) on top.
- **Validation lives in shared code:** `CardEnrichmentSchema`, `SupplementalPackSchema` and `findEventDiscardSelfViolations` are in `src/data/supplemental/schema.ts`, plain zod, usable in the browser.
- **Unlisted packs are invisible:** the loader loads only enabled packs, so only they appear in the editor (an unlisted pack must be enabled first; M7's Content screen says how).
- **Q24 (decided, amended by Q57):** storage driver only, the editor's dev middleware is **deleted**, not kept alongside. Q24 made official packs read-only; Steve's answer (2026-11-01) is that supplemental data must stay editable while the game and engine are developed, so `official-bundled` packs (tracked in this repository, Core today) are writable in dev. Only `official-sync` packs, which the sync command re-downloads and which are not in git, stay read-only. Q55 parked the Tauri driver, so today the only driver the browser has is `FetchDriver`.

## 3. Design

### 3.1 Read: from the loaded content

A pure module `src/data/content/editor-model.ts` builds the editor's view from `LoadedContent` and the meta files: card summaries (name, type, faction, set, pack id, source file stem, has-supplemental, valid, error count), the pack list (id, name, origin, writable), and card details (upstream card, supplemental, validation). The filtering, paging and the status counts that the server did now run in the browser over the in-memory list. No new fetches except `content/meta/*.json`, which `FetchDriver` reads through the existing endpoint.

### 3.2 Write: one method on the storage side

`ContentDriver` gains no write method (the loader stays read-only). A separate `ContentWriter { writeJson(path, data): Promise<void> }` is added; `NodeFsDriver` implements it (tests and scripts), and `FetchDriver` implements it with `PUT /__content/<path>`.

The dev server's `/__content` handler gains the matching `PUT`. It is the **one** write route and it refuses anything that is not all of:
- a path of the form `packs/<id>/supplemental/<name>.json`;
- a pack whose `pack.json` says `origin: "user"` or `"official-bundled"` (Q24 as amended by Q57, Q27); `official-sync` is refused;
- a body that parses and passes `SupplementalPackSchema`;
- the dev server (not `vite preview`).
It writes through a temp file and rename, like the image cache. This replaces the four editor routes and the 560-line service. When the desktop app (#548) exists, the Tauri driver implements `ContentWriter` and the dev `PUT` can be dropped; until then a browser has no other way to reach the disk.

### 3.3 Pack-scoped UI

- A **pack selector** (first filter) lists enabled packs with an origin badge; the previous "pack file" filter becomes the file stem inside the chosen pack.
- A card of a read-only pack (`official-sync`) opens in the inspector with every control disabled, a note ("Synced packs are re-downloaded; edit a copy") and no Save. A card of a user or bundled pack saves through `ContentWriter`; after Save the loaded content is refreshed in memory (`applyContent` of a reloaded pack) so the list's status updates without a page reload, and a note says the game needs a reload to see it.
- New supplemental data goes to the file whose stem matches the card's source file (`cards/<stem>.json` to `supplemental/<stem>.json`), created if absent. A pack with no cards cannot be edited (nothing to attach data to).

### 3.4 Not in M9

Creating or editing the **cards** themselves (upstream-shaped JSON stays hand-written, Q7 postpones authoring tools), the Scenario Editor, editing pack manifests, editing decks, a browser file-system driver (M11), Tauri.

## 4. Simplification & Refactor Check

- The editor stops having its own reader of the content folder: `listCardFiles`, the upstream card cache and the pack-file reading in `api-middleware.ts` go away; loaded content is the single source.
- One write route with one rule set replaces four editor routes; the client no longer imports types from a `tools/` file.
- Validation is already shared code; nothing is copied.

## 5. Debt Removed

- `src/tools/editor/api-middleware.ts` (the editor service and middleware) and its Vite plugin.
- The editor's second reader of the content folder (`CardSupplementalService.loadAllUpstreamCards`, `readSupplementalPack`).
- Client code importing types from a dev-server module.
- The "any file under any pack is writable" behaviour of the editor: the write rule now names the origins, the folder and the schema.

## 6. File changes

| File | Change | Serves |
| --- | --- | --- |
| `src/tools/editor/api-middleware.ts`, `vite.config.ts` (plugin entry) | [DELETE] | Debt Removed |
| `src/data/content/editor-model.ts` | [NEW] summaries, filters, details from loaded content | Authoring scenario |
| `src/data/content/types.ts`, `drivers/node-fs.ts`, `drivers/fetch.ts` | [MODIFY] `ContentWriter`, `writeJson` | Authoring scenario |
| `src/tools/content-middleware.ts` | [MODIFY] guarded `PUT` | Authoring scenario |
| `src/ui/services/supplemental-editor-service.ts` | [MODIFY] uses the model and the writer, no fetch of `/api/supplemental` | Authoring scenario |
| `src/ui/components/editor/SupplementalEditorScreen.tsx`, `CardFilterToolbar.tsx`, `CardGalleryList.tsx`, `DualCardInspector.tsx` | [MODIFY] pack selector, read-only mode | Authoring scenario |
| `docs/decisions/0092-content-packs-and-runtime-loading.md` (decision 9, Q57), `docs/specifications/tooling/card_supplemental_editor.md`, `docs/specifications/content_plugins_scenarios_and_campaigns.md`, `content/README.md` | [MODIFY] new data flow and write rule | Docs |
| `changes/unreleased/*.md` | [NEW] | Changelog |

## 7. UI and Card Editor

This milestone is the Card Supplemental Editor change, so the editor is in scope: pack selector, origin badge, read-only mode (3.3). The game UI is unchanged. Browser check, run once: (1) enable `my-hero-pack`, edit a card, Save, reload, the data is in the game; (2) edit a Core card, Save, `git status` shows only that supplemental file changed; (3) a `PUT` for an `official-sync` pack path or a non-supplemental path returns 403.

## 8. Tests

- `tests/data/editor-model.test.ts`: summaries, status counts, filters and paging over a loaded temp content folder; writable for `user` and `official-bundled` packs, not for `official-sync`.
- `tests/tools/content-middleware.test.ts` (extends the existing one): `PUT` accepts a user or bundled pack's supplemental path and writes it atomically; rejects an `official-sync` pack, a wrong path, an invalid body, `..` segments.
- `tests/ui/supplemental-editor-service.test.ts` and the four editor UI tests updated for the new service; one new test for the read-only inspector.
- `tests/tools/supplemental-editor-api.test.ts` is deleted with the code it tested; its validation cases (event discard self, schema errors) move to the `editor-model` and middleware tests, so no coverage is lost.

## 9. Open decisions

1. **Answered (Steve, 2026-11-01): tracked packs stay editable in dev (Q57).** The editor writes `user` and `official-bundled` packs; only `official-sync` packs are read-only. This amends Q24, which had made all official packs read-only.
2. **Dev server `PUT` as the one write route** (recommended; a browser cannot write to disk, and Tauri is parked; with decision 1 answered it also keeps Core editing in the editor). Alternatives: Save downloads the file for the user to drop into the pack (no server write at all, but clumsy), or keep M9 for after the desktop app. Q55 and the M7 plan said dev middleware should not grow; this is one guarded route replacing four.
3. **Editor lists enabled packs only** (recommended: it is what the loader gives). To edit an unlisted pack the user first enables it in `content/config.json`.
4. **Keep the file-stem filter inside a pack** (recommended; cards are split into several files per pack and the editor already filters by them).
5. **Order:** M9 after M7 is merged (recommended), then M10.
