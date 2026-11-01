# Plan — M6: Card art is cached per pack

**Status:** approved 2026-11-01 (decisions Q50 to Q54 in the parent plan); being implemented in one PR. The handover for the next session is [`handover_content_refactor.md`](handover_content_refactor.md).
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (Q23, Q26, Q30, Q36, section 3.2 step 4; roadmap row M6) and [ADR-0092](../decisions/0092-content-packs-and-runtime-loading.md) (decision 8, "Images"), which partly supersedes [ADR-0011](../decisions/0011-card-orientation-and-art-caching.md).
**Depends on:** M3 (the loader and `getLoadedContent`) and M4 (the content root and `content/.cache/`), both merged. Independent of M5, M6b (Tauri scaffold) and M7.
**Gate note:** Gate 1 (Rhino) is still active, but M6 touches no engine file. The gate is that the card data hash and `simulate --no-stats` output stay byte-identical, and that the browser check in section 8 shows every card of a Rhino game with its art.

## In-Game Scenario

**Setup:** Spider-Man (Peter Parker, hero form), one player, Rhino, stage I, Core enabled. Fresh checkout: no images on disk yet. The dev server runs.
**Player does:** Starts the mission, looks at the villain, the main scheme (both sides over the game), the hand and the encounter deck backs, then reloads the page.
**Today:** Every card shows its art. The images are fetched from MarvelCDB on first sight and kept in a `cache/` folder at the repository root, in one flat pile shared by all packs. The main scheme art of the Core Set is found through a rule hard-coded for card codes starting with `01` (its A and B sides are swapped upstream). A production build copies the whole pile into `dist/`.
**After this change:** The same game looks the same. The art for Core cards is cached in `content/.cache/images/core/`, art for a Green Goblin card in `content/.cache/images/gob/`, and the three generic card backs in `content/.cache/images/_backs/`. The swapped Core main scheme sides are declared by the Core pack itself, not by a code prefix. A production build contains **no** official art; where it runs with a server, the images are fetched on demand like in development.
**Why (rules):** None. This is about where art lives and who is allowed to ship it (Q23), not about gameplay.

**Scenario 2 (a user pack):** Steve installs a fan pack `my-hero-pack` with a hero card `my-hero-pack-0001a` and puts `my-hero-pack/assets/cards/my-hero-pack-0001a.png` in it. The hero shows the pack's own art on the table, with no request to MarvelCDB (the code does not exist there). A card of that pack without a file shows the comic placeholder.
**Scenario 3 (offline):** After one online game of Rhino, the player unplugs the network and starts the same game. Every card that was seen before still shows its art (disk cache, then the browser cache).

## 1. Goal

After M6 the image cache has one home, `content/.cache/images/<packId>/`, found through the shared content-path helper (Q30); the filename of a card's art comes from its pack, not from a `'01'` prefix check; a pack can ship its own art; and no build output contains official art (Q23). The three duplicated copies of the download logic (dev server, `cache:cards` script, a test that re-implements the middleware) become one module.

## 2. Facts (verified 2026-11-01 on `main`)

- **Where images live now:** `cache/cards/<file>.png` and `cache/back/<player|encounter|villain>.png` at the repository root, gitignored (`.gitignore`, lines `cache/`, `/cache/` and their `**` forms). `content/.cache/` is already gitignored (it holds `upstream/`, the sync download) and `content/README.md` calls it disposable.
- **Serving:** `cardCachePlugin()` in `vite.config.ts` answers `/cards/<file>.png` and `/back/<file>.png` (also with a `/cache/` prefix, used by nothing found in `src/`). Cache hit: stream the file. Miss: download from `https://marvelcdb.com/bundles/cards/<file>` (card backs from `hallofheroeslcg.com`), temp file, atomic rename, deduplicated in flight. Filenames are checked against `^[a-zA-Z0-9_-]+\.png$`. It is registered for the dev server **and** `vite preview`.
- **Production copy:** the same plugin's `closeBundle()` copies `cache/cards` and `cache/back` into `dist/cards` and `dist/back`. `docs/coding_guidelines.md` (lines 281 to 282) documents this as "bundled directly to `dist/cards/` to ensure offline desktop/web play". That contradicts ADR-0011 ("never packaged") and Q23 ("never bundled or committed, including in a shipped Tauri build"): a build made on a machine with a warm cache ships official art.
- **Client:** `src/ui/services/card-cache-service.ts` builds `/cards/<file>`, reads/writes the browser `CacheStorage` entry `mcd-card-art-v1` keyed by that URL, and falls back to a plain `<img>` on the CDN URL (`getRemoteMarvelCdbUrl`). `useCardArt` is used by `CardView` and `CardArtThumbnail`; both fall back to the CDN URL on error. Card backs go through `getCardBackUrl` (`/back/<type>.png`).
- **The `01` special case:** `resolveMainSchemeArtFileName` returns `<base>b.png` for side A and `<base>.png` for side B when the code starts with `01`, and the opposite for every other pack. Evidence from the data: Core main scheme `01097a` (stage 1A, `back_link` `01097b`) is the only shape where A is the back-linked, "setup" face; Green Goblin `02004a` has the same stage and link, so the data does **not** say which file is which. The rule has to be declared.
- **Duplicated download logic:** `scripts/cache-card-images.ts` has its own `downloadImage` (a weaker copy: no temp file, no redirect handling, no User-Agent) next to the one in `vite.config.ts`. It also imports a pure naming function from `src/ui/services/`. `tests/ui/card-cache-middleware.test.ts` re-implements the middleware inside the test and tests that copy, not the real code.
- **Pack ownership of a card:** `LoadedPack.cards` holds each pack's cards and the loader already claims every card code per pack (`ClaimRegistry`), so the owning pack of a code is known at boot. The card's `packCode` is _not_ the pack id (a Green Goblin encounter card has `gob_encounter`, its file sits in pack `gob`).
- **Manifest:** `pack.json` is strict (`PackManifestSchema`), with `origin: official-bundled | official-sync | user`. It has no art field. The agreed pack layout (parent plan, 3.1) reserves `assets/cards/<code>.png` for pack art, and nothing reads it.
- **Tauri:** `src-tauri/` does not exist. M6b will need its own implementation of "serve a cached image", so the contract must be small.

## 3. Design

### 3.1 One cache layout

```
content/.cache/images/
  <packId>/<file>.png        # MarvelCDB art for that pack's cards
  _backs/<type>.png          # the three generic backs (an id cannot start with `_`, so no pack can collide)
```

`src/tools/content-paths.ts` (the Q30 helper) gains `imageCacheDir(packId, base?)`; the dev root vs app-data root (Q26) stays in that one place. No code reads or writes the old root `cache/` folder any more, and **nothing deletes it** (decision 2): the folder and its `.gitignore` lines stay on disk and in the repo until the new cache is proven in use. The `**/cache/**` watch and search ignores and the `code-audit` mention stay for the same reason.

### 3.2 Art file names come from the pack

A new data-layer module `src/data/content/card-art.ts` (no React, usable by the dev server, the script and the UI) owns:

- `artFileName(card, packManifest)`: `<code>.png`, except main schemes, where the two sides map to `<base>.png` / `<base>b.png`, **swapped** when the pack declares `art.swapMainSchemeSides`.
- `artPackId(code)`: the owning pack from the loaded content (uses the claims the loader already makes; the store keeps the map).
- `cardArtUrl(card)` returns `/card-art/<packId>/<file>.png`; `cardBackUrl(type)` returns `/card-art/_backs/<type>.png`. The remote MarvelCDB URL is built here too, so the UI no longer builds URLs.

`PackManifestSchema` gains an optional `art: { swapMainSchemeSides: boolean }` (default `false`), the schema JSON is regenerated, and **only the Core `pack.json` sets it**. `resolveMainSchemeArtFileName` and the `startsWith('01')` check are deleted. `getCardArtFileName` and the other pure naming code in `src/ui/services/card-cache-service.ts` move to the new module; the UI service keeps only the browser `CacheStorage` and object-URL logic.

### 3.3 Resolution order for one card's art

1. **Pack asset:** `content/packs/<id>/assets/cards/<file>.png` (any origin). Served straight from the pack folder, never copied into the cache.
2. **Disk cache:** `content/.cache/images/<id>/<file>.png`.
3. **MarvelCDB** (only when the pack's `origin` is an official one): download into 2, then serve it.
4. **Placeholder:** the comic vector card the UI already shows (`CardView`), also for a user pack card without an asset (a user card code does not exist on MarvelCDB, so no request is made).

The browser then keeps its own `CacheStorage` copy as today (steps 1 to 3 of ADR-0011's lifecycle stay; its disk location and URL change).

### 3.4 One image cache module on the Node side

`src/tools/image-cache.ts` (Node only, like `content-paths.ts`) exports `resolveCardImage(packId, file)` (assets, then cache, then download with temp file, atomic rename, redirects and User-Agent, deduplicated in flight) and the back-image variant. It is used by:

- the Vite plugin, now a thin request router for `/card-art/<packId>/<file>.png` (pack id checked against the pack id pattern, file against the existing filename pattern; unknown pack: 404; no directory traversal);
- `scripts/cache-card-images.ts`, which loops over the loaded packs (all enabled packs by default, `--pack <id>` for one) and calls the same function;
- a real test, replacing `tests/ui/card-cache-middleware.test.ts`.

The `closeBundle()` copy of art into `dist/` is deleted (decision 1). `vite preview` keeps the route, so a built app run through `vite preview` fetches art on demand exactly like development.

## 4. Simplification & Refactor Check

- **Merge:** two download implementations (plugin, script) into `image-cache.ts`; the pure naming functions out of a UI service into the data layer; the two plugin routes (`cards`, `back`) into one `/card-art/<packId>/` route.
- **Reuse, don't add:** `content-paths.ts` for the directory, `ClaimRegistry` ownership already recorded by the loader, the existing filename validation, the existing `CardView` placeholder.
- **Delete:** the `'01'` special case, the `/cache/` URL prefix (no user found), the dist copy, the copy of the middleware inside the test, the weaker script downloader.
- **No dual paths:** the old `/cards/` and `/back/` URLs are not kept beside the new ones, and no code reads the old `cache/` folder; it is only left on disk (decision 2).

## 5. Delivery: one PR

The URL (`/card-art/<packId>/...`) and the folder (`content/.cache/images/<packId>/`) change together; any split would need the server to serve the new URL from the old folder, which is a shim. So M6 is **one PR**, parity-checked: the card data hash and `simulate --no-stats` output stay byte-identical to `main` (nothing in the engine changes), the full suite passes, and the browser check of section 8 passes. If review shows it is too wide, the only clean split is naming first (`art` manifest field, `card-art.ts`, deleting the `01` rule, same URLs and folder) and layout second (new URL, `image-cache.ts`, `content/.cache/images/`, `assets/`, dist copy removal); Steve's decision 5 picks.

## 6. File changes (summary)

| Area                                                                                                                                                                                                         | Change                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/data/packs/pack-manifest.ts` (+ `pack.schema.json`)                                                                                                                                                     | `[MODIFY]` optional `art.swapMainSchemeSides`. Scenario 1 (Core main scheme art)                                                                       |
| `content/packs/core/pack.json`                                                                                                                                                                               | `[MODIFY]` `"art": { "swapMainSchemeSides": true }`. Scenario 1                                                                                        |
| `src/data/content/card-art.ts`                                                                                                                                                                               | `[NEW]` naming, owner, local and remote URL. Scenarios 1 to 3                                                                                          |
| `src/data/content/store.ts` / `apply.ts`                                                                                                                                                                     | `[MODIFY]` keep the code-to-pack map filled at boot and cleared by `resetContent`. Scenarios 1, 2                                                      |
| `src/ui/services/card-cache-service.ts`                                                                                                                                                                      | `[MODIFY]` only `CacheStorage` and object URLs; naming and URL code removed; cache name bumped (section 9). Scenario 3                                 |
| `src/ui/hooks/useCardArt.ts`, `CardView.tsx`, `CardArtThumbnail.tsx`, `VillainZone.tsx`, `PlayerHandTray.tsx`, `FacedownEncounterCard.tsx`                                                                   | `[MODIFY]` new URL helpers; the CDN fallback is built by `card-art.ts`. Scenario 1                                                                     |
| `src/tools/content-paths.ts`                                                                                                                                                                                 | `[MODIFY]` `imageCacheDir`. Scenario 1                                                                                                                 |
| `src/tools/image-cache.ts`                                                                                                                                                                                   | `[NEW]` resolve and download. Scenarios 1 to 3                                                                                                         |
| `vite.config.ts`                                                                                                                                                                                             | `[MODIFY]` thin `/card-art/` router; delete `closeBundle` copy and the downloader; watch ignore `**/cache/**` becomes `**/.cache/**`                   |
| `scripts/cache-card-images.ts`                                                                                                                                                                               | `[MODIFY]` per-pack loop on `image-cache.ts`, `--pack` option                                                                                          |
| `tests/ui/card-cache-middleware.test.ts`                                                                                                                                                                     | `[DELETE]` replaced by `tests/tools/image-cache.test.ts`                                                                                               |
| `tests/ui/card-cache-service.test.ts`, `card-back-service.test.ts`, `setup.ts` mock                                                                                                                          | `[MODIFY]` follow the move                                                                                                                             |
| `.gitignore`, `.vscode/settings.json`, `.agents/skills/code-audit/SKILL.md`                                                                                                                                  | `[MODIFY]` only `vite.config.ts`'s watch ignore gains `**/.cache/**`; the `cache/` entries stay (decision 2); `content/.cache/` is already ignored     |
| `docs/decisions/0011-...md`                                                                                                                                                                                  | `[MODIFY]` status line only, location of the cache and "no dist copy" stated in ADR-0092 terms; no history note in the body (Documentation invariants) |
| `docs/decisions/0092-...md`, `docs/coding_guidelines.md` (lines 281 to 282), `docs/specifications/content_plugins_scenarios_and_campaigns.md` (line 211), `content/README.md`, `docs/guidelines/` pack guide | `[MODIFY]` current state: layout, resolution order, `assets/cards/`, the `art` manifest field                                                          |
| `changes/unreleased/`                                                                                                                                                                                        | `[NEW]` fragment                                                                                                                                       |

## 7. Tests

- **Naming (Scenario 1):** `artFileName` for a hero, a double-sided card, a main scheme with the Core pack (sides swapped) and with a pack that does not declare it (not swapped); a user card code.
- **Owner lookup (Scenarios 1, 2):** a Core card, a `gob_encounter` card (owner `gob`), a user pack card, an unknown code; cleared by `resetContent`.
- **Image cache (`tests/tools/image-cache.test.ts`, Scenarios 1 to 3):** against a temp content root and a local HTTP server standing in for MarvelCDB: pack asset wins over cache; cache hit makes no request; miss downloads once, writes atomically and deduplicates two concurrent requests; a 404 leaves no file; a `user`-origin pack never requests the remote; bad pack id and bad filename are rejected; no path escapes the pack folder.
- **Route:** the real router, not a copy of it, returns 200, 400, 404 with the right headers.
- **UI:** `CardView` renders the new URL, falls back to the CDN for an official card and to the placeholder for a user card; the existing card-back tests with the new URL.
- **Zero-pack:** `artPackId` and the URL helpers do not throw with no pack loaded.

## 8. Verification (once per PR, after the last edit)

`tsc`, lint, format, `docs:check`, `deadcode`, `pack:validate -- content/packs`, the full `npm test`, and `npm run simulate -- --no-stats` compared byte for byte with a clean `main` run (nothing in the engine changes). **Browser check** (dev server on a free port, stopped afterwards): start a Rhino game, confirm in the network panel that art comes from `/card-art/core/...`, that the Rhino main scheme shows the same face on side A and B as before, that `content/.cache/images/core/` fills, and that the console is clean; then copy a small fixture user pack with one asset into a temporary content root and confirm Scenario 2. Build with `npm run build` and confirm `dist/` holds no `.png` card images.

## 9. Debt Removed

- The `startsWith('01')` Core special case in a UI service.
- The second downloader in `scripts/cache-card-images.ts` and the one in `vite.config.ts` (merged), and the test that re-implemented the middleware instead of testing it.
- The flat, pack-blind `cache/` pile as a place code reads or writes, and the unused `/cache/` URL prefix. The folder itself and its ignore entries are removed in a later cleanup, once Steve has seen the new cache work (decision 2); that cleanup is on the handover list.
- The `closeBundle()` copy of official art into `dist/` and the guideline sentence that documents it.
- The pure naming and URL code living in a React-side service although a Node script imports it.
- The browser cache name `mcd-card-art-v1` holds entries keyed by the old URLs; the name is bumped (`v2`) and the new key set starts empty. No code deletes `v1`: those entries are unreachable and the browser evicts them; `clearCardArtCache` clears the current cache only. (A one-time delete would be a shim that stays forever.)

## 10. UI and Card Editor impact

UI: art URLs and the placeholder for cards without art; no visual change for Core. Card Editor: the editor shows card art through `CardArtThumbnail`, so it follows the same helper; editing user pack cards will show the pack's `assets/` art once M9 moves the editor to user packs. No editor schema change (the `art` field is a manifest field, not a card field), so there is nothing to bind in the editor; evidence: `rg "swapMainScheme|art:" src/ui/editor` finds no existing binding to extend.

## 11. Decisions and open points

Decided by Steve on 2026-11-01 (all as recommended; numbers 1 to 5 are Q50 to Q54 of the parent plan):

1. **A production build ships no official art.** Today `npm run build` copies the cached images into `dist/`. **Recommend deleting the copy** (Q23, ADR-0011): a built app fetches art on demand through `vite preview` or, in the Tauri build, through M6b's cache; the offline-play promise then rests on the on-disk cache filled during an online session, not on art inside the bundle.
2. **Old `cache/` folder: leave it alone until the refactor is proven (Steve, 2026-11-01).** No code reads, moves or deletes it, and no migration code is written (a mover would be a shim). The new cache fills on first sight; contributors may copy `cache/cards/*` for Core cards into `content/.cache/images/core/` to skip a refetch. After Steve has run the game on the new cache and says it works, a small cleanup PR deletes the folder's `.gitignore` entries, editor ignores and the `code-audit` mention.
3. **Does a pack's `assets/cards/` apply only to its own cards?** **Recommend yes.** A user pack cannot replace the art of an official card (its asset names must be its own codes). Letting a pack re-skin official cards would need a rule about which pack wins when two do; it can be added when someone needs it.
4. **Where the main scheme rule is declared.** **Recommend** an optional manifest field `art.swapMainSchemeSides`, set in the Core `pack.json` only (alternatives: a per-card field in the cards data, which `sync` would overwrite). Is that the only pack with swapped sides? Every pack from `02` on follows the standard convention in the current code; I did not fetch images to prove it.
5. **One PR or two.** **Recommend one PR** (section 5). The alternative is the naming-first split described there; it keeps both PRs shim-free but doubles the review.

Decided by me (listed per the stop policy; say so if you disagree):

6. `cache:cards` caches **all enabled packs by default**, `--pack <id>` for one.
7. A **user-origin pack never contacts MarvelCDB**; its cards without an asset show the placeholder.
8. The three card backs live in `_backs/` and still come from `hallofheroeslcg.com`; that source is unchanged.
9. The browser cache name is bumped to `v2` (section 9).
10. The route is `/card-art/<packId>/<file>.png`; `vite preview` keeps it.

## 12. Done when

The image cache is only ever read and written under `content/.cache/images/`, no code names a pack by a card-code prefix, a user pack's `assets/cards/` art shows on the table, `npm run build` produces no card images, there is one download implementation tested through its real entry points, and the card data hash and `simulate` output match `main`.
