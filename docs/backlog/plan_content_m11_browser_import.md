# Plan — M11: A player adds a content pack in the browser, without a terminal

**Status:** draft 2026-11-01. Waiting for review (open decisions in section 9).
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (Q5, Q25, Q26, Q55; roadmap row M11) and [ADR-0092](../decisions/0092-content-packs-and-runtime-loading.md).
**Depends on:** M2, M3, M7, M9, M10 (all merged). Independent of the parked desktop app (#548).
**Gate note:** Gate 1 (Rhino) is active. M11 touches no engine file. Proof: seeded Rhino game and `simulate --no-stats` byte-identical, full suite green, and the browser check in section 7.

## In-Game Scenario

In-Game Scenario: none (content management; the game plays the same).

**Authoring scenario (stands in for it):**
**Setup:** A friend sends Steve `crimson-heroes.zip`, a user pack. Steve runs the game from a build with no pack of his own (`npm run dev`, Core enabled).
**Does:** On the Content screen he presses **Import pack (zip)**, picks the file, reads the summary ("Crimson Heroes 1.0.0, 22 cards, no scenario, JSON only"), confirms, and sees the pack listed as **Data only** or **Playable**. Later he presses **Export** on his own pack and gets a zip he can send back.
**Today:** Both buttons exist on the welcome screen and are disabled with "Needs the desktop app or browser import, which are not built yet." The only way to add a pack is to copy a folder into `content/packs/` and edit `content/config.json` by hand (`creators/sharing-and-installing.md`, "Not built yet").
**After this change:** The buttons work. An imported pack is stored in the browser (IndexedDB), is loaded beside the repository's packs, survives a reload, and can be exported or removed. Nothing is written into `content/` by an import.
**Why (rules):** None. This is about where packs live and how they get in, not about gameplay.

## 1. Goal

After M11 a player can import a user pack from a zip, list, enable, export and remove it, all from the Content screen, in any current browser, with the same validation `pack:validate` applies. Distribution of official packs stays out (Q25).

## 2. Facts (verified 2026-11-01 on `main`)

- **Drivers:** `ContentDriver` (`listFiles`, `listDirs`, `exists`, `readJson`) and `ContentWriter` (`writeJson`) in `src/data/content/types.ts`. Implementations: `NodeFsDriver` (tests, scripts) and `FetchDriver` (browser, reads `/__content/index.json`, PUT only for supplemental files of writable packs on the dev server).
- **Boot:** `src/main.tsx` calls `bootContent(new FetchDriver('/__content'))`; `loadContent` reads `config.json`, loads the enabled packs plus dependencies, validates manifests, files and cross-pack claims, and reports per-pack failures with `blockedBy`. `apiVersion` is checked there already.
- **Welcome screen:** `Add content folder` and `Import pack (zip)` are rendered disabled with one shared reason (`WelcomeScreen.tsx`). The Content screen shows pack states and failures.
- **Validation split:** `pack:validate` (`scripts/pack-validate.ts`) is the thorough check (reserved ids, user-code ban, card-code pattern, card schema, duplicate codes, supplemental keys) but reads the disk with `fs`. The loader does the schema and identity checks in the browser but not the user-pack rules (reserved id, `scripts/` ban, card-code pattern).
- **No zip library** is a dependency.
- **Art:** official art is fetched from MarvelCDB into a local cache; a pack's own art is `assets/cards/<file>.png` (`card-art.ts`).
- **Q25/Q26/Q55:** public releases are dev-only until there is a content source; the OS app-data root belongs to the desktop app; the browser needs its own store.

## 3. Design

### 3.1 A browser store: IndexedDB pack driver

`IndexedDbDriver` implements `ContentDriver` and `ContentWriter` over one object store keyed by path (`packs/<id>/...`). It holds **user packs only**. At boot the app builds a `LayeredDriver([FetchDriver, IndexedDbDriver])`: reads go to the first layer that has the path (repository content wins), listings merge, writes go to the layer that owns the path (the IndexedDB layer for `packs/<id>/` of an imported pack; the dev server for repository packs, as today). `config.json` stays in the repository layer in dev; the enabled list for imported packs is kept in the IndexedDB layer (`user-config.json`) and merged, so an import never edits the repository.

### 3.2 Zip import

A pure `importPackZip(bytes, existing)` in `src/data/content/pack-zip.ts`:

1. Unzip in memory (library: `fflate`, MIT, a few KB; decision 3). Reject before reading when the archive is over the caps (decision 4).
2. Require exactly one pack: `pack.json` at the root or inside one top-level folder; the folder name is ignored, the manifest `id` wins.
3. Stage the files into an in-memory driver and run `validateUserPack(driver, existingPackIds, officialCodes)`, a new driver-based validator that both `pack:validate` (through `NodeFsDriver`) and the import use, so the two cannot drift. It enforces: manifest schema, `origin: "user"` forced (an archive that claims anything else is refused, never rewritten silently), `apiVersion` not newer than the engine, reserved ids, no `scripts/`, card-code pattern, card schema, per-file schemas, supplemental keys, duplicate codes against enabled packs, file names limited to `[a-z0-9._-]` plus `/`, no `..`, only `.json`, `.png`, `.jpg`, `.webp`.
4. Return a summary (name, version, card count, scenario count, files, size, findings). The UI shows it and asks to confirm; nothing is stored before that.
5. An existing pack with the same id is not replaced silently: the dialog says "Replace Crimson Heroes 0.9.0 with 1.0.0?" and replacement removes the old files first.

### 3.3 Export and remove

`exportPackZip(driver, id)` zips a pack's files (cards, supplemental, scenarios, decks, assets) and names it `<id>-<version>.zip`. Export is offered for user packs and for imported ones; the Core pack is not exportable (official content is not ours to redistribute, Q56 spirit). Remove deletes an imported pack's files and its enabled flag after a confirmation.

### 3.4 UI

Welcome and Content screens: **Import pack (zip)** opens a file picker and then the summary dialog; each imported pack row shows **Export**, **Remove** and its `version`. Error text names the first finding and lists the rest. English only. The disabled reason of **Add content folder** becomes "Needs the desktop app (planned)"; the zip button loses its disabled state. The editor (M9) can save into an imported pack through the same `ContentWriter`, so no editor change.

### 3.5 Versioning

`version` is shown and stored but not compared; `dependsOn` stays by id without ranges (a range syntax is added when a real need appears). `apiVersion` handling is unchanged: newer than the engine is refused at import and at load.

### 3.6 Not in M11

The File System Access folder driver (decision 1), official-pack distribution (Q25), any code in packs (JSON only), sandboxed hooks, merging of two packs, cloud sync, French UI.

## 4. Simplification & Refactor Check

- One validator (`validateUserPack`) behind `pack:validate` and the import, instead of a thorough Node-only one and a lighter browser one.
- The boot driver is built in one place (`createBootDriver`), so tests, the app and a future desktop driver compose the same way.
- The two permanently disabled buttons are replaced by one working button and one honestly labelled one.

## 5. Debt Removed

- `scripts/pack-validate.ts` reading `fs` directly for the checks that also matter in the browser.
- The creator docs' "Not built yet" paragraph for zip import (replaced by the real steps).
- The welcome screen's shared "not built yet" reason covering two different features.

## 6. File changes

| File                                                                                         | Change                                                      | Reason                                      |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| `src/data/content/drivers/indexeddb.ts`, `layered.ts`                                        | [NEW]                                                       | Browser store and the composition of layers |
| `src/data/content/pack-zip.ts`                                                               | [NEW]                                                       | Import and export                           |
| `src/data/content/validate-user-pack.ts`                                                     | [NEW]                                                       | Shared driver-based validator               |
| `scripts/pack-validate.ts`                                                                   | [MODIFY] delegates to the shared validator                  | One validator                               |
| `src/data/content/apply.ts`, `src/main.tsx`                                                  | [MODIFY] build the layered driver; merge `user-config.json` | Boot                                        |
| `src/ui/components/setup/WelcomeScreen.tsx`, `ContentScreen.tsx`, new `ImportPackDialog.tsx` | [MODIFY]/[NEW]                                              | UI                                          |
| `package.json`                                                                               | [MODIFY] `fflate`                                           | Zip                                         |
| `docs/creators/sharing-and-installing.md`, `README.md`, ADR-0092 (decision 10)               | [MODIFY]                                                    | Docs                                        |
| `tests/data/*`, `tests/ui/*`, `changes/unreleased/*.md`                                      | [NEW]                                                       | Proof                                       |

## 7. Tests and proof

- `pack-zip`: imports `docs/creators/examples/first-pack` zipped in the test; refuses each rule in 3.2 (wrong origin, `scripts/`, `../` path, reserved id, newer `apiVersion`, duplicate card code, oversize, two packs); round trip export then import gives identical files.
- `IndexedDbDriver` against `fake-indexeddb` (devDependency): list, read, write, delete; `LayeredDriver`: precedence, merged listings, write routing.
- UI: zero-pack welcome imports the example zip and the pack appears as Data only; replace dialog; remove.
- Browser check on `npm run dev` (Chromium): import `first-pack.zip`, reload, still there, export, remove.
- Gate proof as in the gate note.

## 8. Risks

- Browser storage can be cleared by the user or the browser; the export button is the backup, and the Content screen says so once.
- A hostile zip: caps, path rules and JSON-only content are the defence; nothing from an import is ever executed.

## 9. Open decisions (recommendation first)

1. **Order and scope.** Recommended: IndexedDB store plus zip import/export now; the File System Access folder driver (Chromium only) is a later PR if wanted. Alternative: folder driver first (no zip, permission prompt each session), or park M11 until public releases exist.
2. **Imported packs and the repository.** Recommended: layered driver, repository content wins on a path clash, nothing is written to `content/`. Alternative: import into `content/packs/` through the dev server (dev only, edits tracked files).
3. **Zip library.** Recommended: `fflate` (MIT, tiny, no dependencies). Alternative: write a minimal reader for stored/deflate entries ourselves.
4. **Import caps.** Recommended: 25 MB archive, 2,000 files, 10 MB per file, `.json`, `.png`, `.jpg`, `.webp` only. Alternative: JSON only, no art in imported packs.
5. **Same-id import.** Recommended: ask before replacing, never merge. Alternative: always refuse and require Remove first.
