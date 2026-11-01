# Plan — M3: Runtime `ContentLoader` filling the engine singletons

**Status:** Implemented (PR #536, 2026-11-01). The plan below is kept as written; section 12 lists where the build differs.
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (Q3, Q14, Q17, Q18, Q22, Q28, Q39).
**Depends on:** [M4](plan_content_m4_core_pack_move.md) (content already in `content/packs/<code>/`) and M2 (schemas, `PACK_API_VERSION`, `pack:validate`).
**Decisions taken 2026-10-31:** M4 runs first; the loader fills the existing singletons; the dev app reads content through a dev-server endpoint.

## 1. Goal

Replace the static JSON imports with a runtime loader. After M3 the engine reads cards, supplemental data, modular sets and starter decks from
packs found at runtime, boots with zero packs, and plays exactly the same games as before.

## 2. Rules and spec analysis

No gameplay rule is touched. Verified facts:

- `normalizeRawCard(raw, supplementalEffects = supplementalRegistry)` (`card-loader.ts:243-246`) **bakes `enrichment` into every card when it
  is registered** (`:315`), and registration also computes hero set membership (`:464`). Supplemental data must therefore be in the registry
  **before** cards are registered. This fixes the load order.
- Module-load-time content use (these break under async loading and must change):
  1. `card-loader.ts:581` builds `cardCatalog` from static JSON.
  2. `supplemental/index.ts:13-19` builds `supplementalRegistry` from five static JSON files.
  3. `starter-decks.ts:130-139` fills `starterDeckCatalog` at import.
  4. `modular-sets.ts:2` binds `modular-sets.json` at import.
  5. `tests/setup/freeze-card-catalog.ts:9` freezes the catalog at the top level.
  6. About 35 tests build `new CardCatalog([...])` from imported JSON at file top.
- Everything else reads the singletons inside functions or at render time. `App.tsx` imports them statically, `ScenarioSelector` reads them in
  `useMemo` at first render, so the app needs a content gate before it renders.
- `ScenarioRegistry` already works without content (built-in plugins register at import and do not touch the catalog). **Scenario registration is
  unchanged in M3** and moves in M5 together with Klaw and Ultron code.
- `createGame` is synchronous and stays so; content is loaded once before the first game.
- Vitest `setupFiles` may be async. The `ui` project replaces `fetch` for `/api/*`, so tests must read content through the Node driver, not `fetch`.
- Seeded RNG is deterministic (`src/engine/state/rng.ts`); `npm run simulate` prints a card data hash (`5425bc2b` today).

## 3. Design

### 3.1 Driver interface (read-only)

`ContentDriver { listPacks(): Promise<string[]>; readJson(path: string): Promise<unknown>; exists(path: string): Promise<boolean> }`, paths
relative to the content root (`packs/core/pack.json`).

| Driver | File | Used by |
| --- | --- | --- |
| `NodeFsDriver` | `src/data/content/drivers/node-fs.ts` (imports `node:fs`; **never imported by browser code**) | tests, `scripts/*`, tools |
| `FetchDriver` | `src/data/content/drivers/fetch.ts` | browser (Vite dev/preview); a future desktop folder driver (parked, issue #547) would implement the same interface |

### 3.2 Loader

`loadContent(driver, options): Promise<LoadedContent>`:

1. Read the **enabled pack list** (decision 1) and add `dependsOn` closures, topologically ordered.
2. Per pack: parse `pack.json` with `PackManifestSchema`; reject `apiVersion` above `PACK_API_VERSION` (Q39); read `cards/*.json`,
   `supplemental/*.json` (`SupplementalPackSchema`), `modular-sets.json` (`ModularSetsSchema`), `decks/*.json` (`PackDeckSchema`).
3. Identity: reject duplicate pack ids and duplicate card codes across the set, reusing the same pure functions the M2 validator uses (move
   them from `scripts/pack-validate.ts` into `src/data/packs/` so script and loader share one implementation).
4. A pack that fails is **disabled with a reason**, and packs depending on it are disabled too (Q22); the load itself never throws.

Result: `{ packs: LoadedPack[], failures: { packId: string; reason: string }[] }`, where each `LoadedPack` carries `cardCount` and `supplementalCount` so M7's pack list can show Playable / Data only / Needs <pack> (Q45) without a second pass. No globals are touched by `loadContent`.

### 3.3 Applying content to the singletons

`applyContent(content)` in `src/data/content/apply.ts`, in this order: (1) replace the `supplementalRegistry` entries, (2) `cardCatalog.registerCards`,
(3) set the modular-set store, (4) fill `starterDeckCatalog`. `resetContent()` clears all four (used by tests and the editor).

- `cardCatalog` is constructed **empty**; `supplementalRegistry` is the same exported object, cleared and refilled; `starterDeckCatalog` is the
  same exported record. No consumer changes its import.
- `modular-sets.ts` reads from a store set by `applyContent` instead of the JSON import.
- `bootContent(driver)` = `loadContent` + `applyContent`, called once.

### 3.4 Boot points

| Entry | Change |
| --- | --- |
| Browser | `src/main.tsx` awaits `bootContent(new FetchDriver('/content'))` then renders; on failures it still renders (M7 shows them). |
| Vite | New dev/preview middleware serves `/content/` from the repo `content/` folder: GET only, `.json` only, path confined to the content root (reject `..`, absolute paths, symlinks out), and `/content/index.json` listing pack ids. Not copied into `dist`. |
| Tests | New `tests/setup/load-content.ts` (async) runs `bootContent(new NodeFsDriver(...))` **before** `freeze-card-catalog.ts` in both vitest projects. |
| Scripts | `simulate-games.ts`, `cache-card-images.ts` and tools that use the catalog `await bootContent(...)` at the start of `main`. |

### 3.5 Enabled packs

The catalog today holds `core` + `core_encounter` only. Loading all 63 packs would change `getAllCards`, hero lists and the simulation hash. So the
loader loads an **enabled set**, read from `content/config.json` (`{ "enabledPacks": ["core"] }`, tracked, validated by a small schema). User packs
are enabled by adding them (UI in M7). Tests that need another pack call `loadContent(driver, { packs: ['core', 'mts'] })` through a helper.

### 3.6 Tests move onto the loader (Q14)

- `tests/helpers/content.ts`: `rawCards(packCode)`, `loadedPackCatalog(packs)` (builds a fresh `CardCatalog` from a loaded set) for the roughly
  35 tests that import upstream JSON and build their own catalog, plus a one-time loader call for tests that use other packs (`mts`, `aoa`, `cw`,
  `trors`, `warm`, `tt_encounter`, `aos_encounter`).
- The 300+ tests that import the `cardCatalog` singleton need no edit: the setup file fills it.
- Tests that read the supplemental folder with `fs` use the M4 path helper (already done in M4).

## 4. Simplification & Refactor Check

- **Delete:** the four static JSON import blocks (`card-loader.ts:578-581`, `supplemental/index.ts`, `starter-decks.ts`, `modular-sets.ts`), the top-level
  `starterDeckCatalog` fill, and about 35 per-test JSON imports.
- **Merge:** the identity checks of `pack-validate.ts` and the loader become one module; `readCardSchema`/`readOfficialPackCodes` go through the same
  metadata reader as the loader.
- **No dual paths:** nothing keeps a static fallback; if the loader finds nothing the catalog is empty.
- **Not added:** no dependency injection of catalogs (declined), no scenario loading (M5), no write path (M9).

## 5. File changes

| File | Change |
| --- | --- |
| `src/data/content/{types,loader,apply,store}.ts`, `drivers/{node-fs,fetch}.ts` | New. |
| `src/data/packs/identity.ts` | New; shared duplicate and reserved-ID checks moved out of `scripts/pack-validate.ts`. |
| `src/data/importer/card-loader.ts` | `cardCatalog = new CardCatalog()`; drop static imports. |
| `src/data/supplemental/index.ts` | Registry object filled by `applyContent`; drop static imports. |
| `src/engine/decks/starter-decks.ts`, `src/engine/scenarios/modular-sets.ts` | Read from the stores. |
| `src/main.tsx` | Await `bootContent` before render. |
| `vite.config.ts` | `/content/` middleware plugin (dev and preview). |
| `content/config.json`, `src/data/packs/content-config.ts` (+ generated schema) | New. |
| `tests/setup/load-content.ts`, `vitest.config.ts` | Setup file in both projects. |
| `tests/helpers/content.ts` and about 35 tests | Replace JSON imports. |
| `scripts/simulate-games.ts`, `scripts/cache-card-images.ts` | Await boot. |
| `knip.json` | Remove the two `ignore` entries made obsolete. |
| `changes/unreleased/` | Fragment. |

## 6. Tests

| Test | Covers |
| --- | --- |
| `tests/data/content-loader.test.ts` | Empty content root (Q28); valid pack; bad manifest disables only that pack; missing dependency disables dependents; duplicate card codes; apiVersion too new; load order (supplemental before cards, enrichment present on registered cards). |
| `tests/data/content-apply.test.ts` | `applyContent`/`resetContent` fill and clear all four stores; zero packs leaves empty stores. |
| `tests/data/content-parity.test.ts` | Loader result equals the pre-M3 catalog: card count, `hashCardData` of all cards, supplemental key set and starter deck ids against recorded golden values (recorded from M4's tree). |
| `tests/data/fetch-driver.test.ts` | `FetchDriver` against a stub `fetch`; error on 404; path normalisation. |
| `tests/tools/content-middleware.test.ts` | Serves `index.json` and a pack file; rejects `..`, non-`.json`, absolute paths. |
| `tests/ui/zero-pack-smoke.test.tsx` | App/selector render with empty stores without throwing (Q28); the polished empty state is M7. |

## 7. Verification and the parity gate (Q17)

1. Before starting (on the M4 commit): `npm run simulate` and `npm run simulate -- --balance`; keep the card data hash and per-game outcomes
   (winner, rounds, `totalActionsExecuted`; durations vary).
2. After: same commands. **Hash, coverage, Gauntlet results and every balance outcome must match.**
3. `tsc`, lint, `docs:check`, `deadcode`, full `npm test`, `pack:validate`.
4. Manual: `npm run dev`, start a Rhino game with each starter deck once and open the Card Supplemental Editor.

## 8. Debt Removed

- Content baked into module initialisers (four places) and 35 test-local JSON catalogs.
- Two parallel implementations of pack identity checks (validator and, later, loader).
- The `knip` ignore entries that existed only to hide the re-export shims.

## 9. UI and Card Editor impact

With `core` enabled there is no visible change; the app shows nothing until content is loaded (a few milliseconds on dev). With zero packs the scenario
selector and deck builder render empty; their empty states are M7. The Card Supplemental Editor is untouched (still fs through the dev middleware, M9).

## 10. Open decisions

1. **Enabled-pack source (decided, Q48).** `content/config.json`, tracked, `{ "enabledPacks": ["core"] }`. "Load every pack found" was rejected because it changes the catalog and breaks parity.
2. **Preview build.** `vite preview` and `dist` do not serve content; public releases are dev-only (Q25). **Recommend** documenting that `npm run build`
   output needs a content source and failing loudly with a clear message when `/content/index.json` is missing.
3. **Async boot cost in tests.** Loading `core` from disk once per worker adds a few hundred milliseconds per test file. **Recommend** accepting it, and
   measuring it in the PR; cache the parsed JSON per worker in the Node driver if it exceeds about 5% of suite time.

## 11. Done when

No static content import remains in `src/`, the tests pass through the loader, zero-pack boot is proven, and the seeded parity gate is identical.

## 12. As built (PR #536)

Where the merged code differs from the plan above:

1. **Endpoint prefix.** The dev and preview servers serve content at `/__content/`, not `/content/`. Vite itself serves the JSON files that the code imports from the `content/` folder at `/content/...` URLs, and the first version of the endpoint intercepted those module requests (wrong MIME type). Found in the browser check.
2. **Validate, but keep the data as written.** The loader runs zod over supplemental data, modular sets and decks, but hands the engine the original JSON, not zod's parsed copy. zod re-orders object keys, and the simulation's card data hash is a `JSON.stringify` of those objects (`362be14e` became `f843f4c8`). `tests/data/content-parity.test.ts` guards key order.
3. **Cards need only a string `code`.** The upstream card schema requires `code`, `pack_code`, `position` and `quantity`; some real cards have no `name`, so the loader's stricter check failed real packs.
4. **Starter decks are listed by deck id.** File-name order would have made Black Panther the default hero. The five core deck ids were renumbered (Spider-Man 1, Captain Marvel 2, She-Hulk 3, Iron Man 4, Black Panther 5) to keep the old order; one test now reads the id from the deck instead of hard-coding it.
5. **Driver interface.** `ContentDriver` has `listFiles`, `exists` and `readJson` (no `listPacks`); `FetchDriver` derives directory listings from `index.json`. `listDirs` arrives with scenario loading in M5b.
6. **Test helpers.** `tests/helpers/content.ts` provides `loadedRawCards`, `rawCardsOf` and `bootPacks` (the plan named `loadedPackCatalog`). Core pack tests split `core.json` and `core_encounter.json` cards by `faction_code === 'encounter'`.
7. **Suite time** went from about 34 s to 37 to 40 s (about 10%), over the plan's 5% mark. No cache was added: the cost is importing the supplemental schema into every test file for runtime validation. Dropping runtime validation of trusted official packs (they are already covered by `pack:validate`) would recover it; not done.
8. **Not done:** the two `knip` ignore entries (`src/data/index.ts`, `src/data/card-loader.ts`) are still there; whether they are obsolete was not checked. A missing `/__content/index.json` is reported as a load failure and a console warning, not a dedicated error screen (empty states are M7).
9. **Parity.** `npm run simulate` output is byte-identical to `main` (card data hash `362be14e`); `--balance` could not be compared because it crashes on `main` too (#534).
