# Plan — M4: Relocate official content into the `content/` pack layout

**Status:** Implemented (PRs #531 and #535, 2026-11-01). The plan below is kept as written; section 12 lists where the build differs.
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (Q9, Q9b, Q19, Q27, Q30, Q31).
**Order:** runs **before** [M3](plan_content_m3_loader.md) (decided 2026-10-31): M4 is a pure move with static imports pointing at the new paths and zero behavior change. M3 then replaces those static imports with the runtime loader.
**Gate note:** Gate 1 (Rhino) is still active (Q6). The move renames files that Gate 1 card work edits (`supplemental/pack/*.json`, tests). Land M4 as one fast PR when the open PR queue is quiet, and rebase open branches onto it (git follows the renames).

## 1. Goal

Put every official content file in its final pack location so M3 can load from it, without changing any behavior. After M4
the repository has no `data/` folder, no `src/data/supplemental/pack/` and no content under `src/engine/scenarios/`.

## 2. Rules and spec analysis

No gameplay rule is touched. Facts this plan relies on (verified 2026-10-31 on `main`):

- `data/upstream/` has 120 card files in `pack/`, 63 packs in `packs.json`, root metadata (`sets`, `factions`, `types`, `subtypes`,
  `packtypes`, `settypes`), `schema/`, `translations/` (516 files, one test reads one file) and upstream helper scripts nobody calls.
- Upstream file names are not pack codes: `core.json` and `core_encounter.json` both belong to pack `core` (card `pack_code`).
  Six packs have only an `_encounter` file (`gob`, `hood`, `mojo`, `ron`, `toafk`, `twc`).
- Only `core` and `core_encounter` are loaded into the runtime catalog today. Supplemental covers `core` (101 cards),
  `core_encounter` (72), `aoa_encounter` (1: `45109`), `cw_encounter` (1: `56128b`) and `mts` (1: `21054`); every key exists in the
  matching upstream file.
- Runtime static imports: `src/data/importer/card-loader.ts:578-579`, `src/data/supplemental/index.ts:3-7`,
  `src/engine/decks/starter-decks.ts:12-16`, `src/engine/scenarios/modular-sets.ts:2`, and each `built-in/*/plugin.ts` importing its own
  `definition.json`.
- Path users: about 11 scripts and tools, `src/tools/editor/api-middleware.ts`, `scripts/pack-validate.ts`, `.githooks/pre-commit:16`,
  `.agents/skills/commit-and-push/SKILL.md:54`, about 35 tests that import upstream JSON and 12 that read the supplemental folder.
- `docs-check` scans `*.md` under every root folder except `logs, references, changes, temp, dist, coverage, data`.

## 3. Target layout

```text
content/
  README.md                          # what this folder is (short, links to the creator docs when they exist)
  meta/                              # shared catalog metadata (moved from data/upstream root)
    packs.json sets.json factions.json types.json subtypes.json packtypes.json settypes.json
    translations/<locale>/ factions.json packs.json packtypes.json sets.json subtypes.json types.json   # catalog-level translations
    schema/ card_schema.json faction_schema.json pack_schema.json type_schema.json
  packs/
    <code>/                          # one folder per upstream pack code (63)
      pack.json                      # origin: official-bundled; kind from pack_type_code; dependsOn per below
      cards/<code>.json              # and <code>_encounter.json when present (moved unchanged)
      supplemental/<stem>.json       # only where it exists today (core, aoa, cw, mts)
      translations/<locale>/<stem>.json   # the pack's translated cards (de, es, fr, it, ko), same stem as cards/
    core/
      scenarios/{rhino,klaw,ultron}/definition.json (+ README.md)
      modular-sets.json
      decks/core_*.json              # the 5 starter decks
```

- `pack.json`: `id` = the upstream code, `kind` from `pack_type_code` (`core` to `core`, `hero` to `hero`, `scenario` and `encounter` to `scenario`,
  `story` to `mixed`; the 63 packs split 1 / 44 / 7 / 1 / 10), `dependsOn: ["core"]` for every non-core pack, `version` from the sync date.
- **The M2 id pattern is too strict for official codes.** Nine of the 63 fail `^[a-z][a-z0-9-]{2,31}$`: `sm`, `bp`, `tt`, `cw`, `jj` (two letters) and
  `mut_gen`, `next_evol`, `wonder_man`, `luke_cage` (underscores). M4 loosens `PACK_ID_PATTERN` to `^[a-z][a-z0-9_-]{1,31}$` (decision 1, decided as Q47).
- Supplemental `$schema` paths are rewritten to the new relative location of `src/data/supplemental/schema.json`.
- CRLF line endings of the supplemental JSON files are preserved (the move is `git mv` with no content edit except `$schema`).

## 4. Simplification & Refactor Check

- **Delete** the unreferenced upstream helper files (`add_octgnid.py`, `replace.php`, `update_locales.coffee`, `validate.py`,
  `package.json`, `.gitignore`, `README.md`, `.github/`). The sync overwrote them each time and nothing calls them.
- **One path helper (Q30).** Add `src/tools/content-paths.ts` (Node-only, pure path arithmetic, no `fs`): `contentRoot(base)`, `packDir(base, code)`,
  `cardFiles`, `supplementalFile`, `translationFile(code, locale, stem)`, `metaFile`. Replace every hard-coded `data/upstream` and `src/data/supplemental/pack`
  string in scripts, tools, the editor middleware, `pack-validate.ts` and tests with it. No second path convention remains.
- **Do not add a compatibility layer.** Old paths simply stop existing; there is no re-export file or alias (project rule).
- **Merge** `readCardSchema` and `readOfficialPackCodes` (in `scripts/pack-validate.ts`) into the helper's consumers so the validator and the
  future loader read metadata the same way.
- `.githooks/pre-commit` regex and the commit-and-push skill text change from `data/upstream` to `content/`.

## 5. File changes

| Area | Change |
| --- | --- |
| `data/upstream/pack/*.json` (120) | `git mv` to `content/packs/<code>/cards/`. |
| `data/upstream/{packs,sets,factions,types,subtypes,packtypes,settypes}.json`, `schema/` | To `content/meta/`. |
| `data/upstream/translations/<locale>/pack/<stem>.json` (485) | To `content/packs/<code>/translations/<locale>/<stem>.json`, so a pack's files all live in its own folder (Q44). |
| `data/upstream/translations/<locale>/{factions,packs,packtypes,sets,subtypes,types}.json` (31) | To `content/meta/translations/<locale>/` (catalog-level, not owned by one pack). |
| `data/upstream` helper scripts, `package.json`, `.github/` | Deleted. |
| `data/prebuilt_decks/*.json` (5) | To `content/packs/core/decks/`. |
| `src/data/supplemental/pack/{core,core_encounter,aoa_encounter,cw_encounter,mts}.json` | To `content/packs/{core,core,aoa,cw,mts}/supplemental/`; `$schema` rewritten. |
| `src/engine/scenarios/built-in/*/definition.json`, `README.md` | To `content/packs/core/scenarios/<id>/`; the three `plugin.ts` import the new path (until M5). |
| `src/engine/scenarios/modular-sets.json` | To `content/packs/core/modular-sets.json`. |
| `content/packs/*/pack.json` (63), `content/README.md` | New (generated once by a throwaway script, not committed). |
| `src/tools/content-paths.ts` | New helper (section 4). |
| Static importers | `card-loader.ts`, `supplemental/index.ts`, `starter-decks.ts`, `modular-sets.ts`, `scripts/cache-card-images.ts`, and the three `plugin.ts` change import paths only. |
| Scripts and tools (11) | `extract-card`, `cache-card-images`, `pack-validate`, `tools/audit/{card-text-parser,supplemental-declarations-analyzer,get-card-data,audit-phase-triggers,run-ambiguity-cards-review,schema-member-coverage,migrate-declarative-taxonomy}`, `tools/migrate-supplemental-to-steps`: use the helper. |
| `src/tools/editor/api-middleware.ts` | Resolve upstream and supplemental locations through the helper; keep its endpoints and behavior. |
| `src/data/packs/pack-manifest.ts`, `pack.schema.json`, `tests/data/pack-manifest.test.ts` | Loosen `PACK_ID_PATTERN` (decision 1) and regenerate the schema. |
| `tools/generate-supplemental-schema.ts` | Unchanged (schema outputs stay in `src/data`). |
| `scripts/pack-status.ts`, `package.json` | New `npm run pack:status` (Q45): one row per pack (cards, cards with supplemental data, enabled per `content/config.json` once M3 adds it, otherwise all listed as not enabled). Built on the path helper; shares the supplemental counting with the declarations analyzer instead of re-implementing it. |
| `tools/audit/docs-check.ts` | Add `content` to the root skip list (pack READMEs are content, not docs). |
| `.gitignore` | Add `content/.cache/`. |
| `.githooks/pre-commit`, `.agents/skills/commit-and-push/SKILL.md` | Path regex. |
| `.vscode/settings.json` | Supplemental `fileMatch` to `content/packs/*/supplemental/*.json`. |
| `AGENTS.md` and skills `card-integration-protocol`, `single-card-supplemental`, `bug-fix`, `.agents/rules/*`, `CONTRIBUTING.md`, docs that cite the old paths | Update citations in the same change (about 22 docs hits listed in `content_coupling_audit.md`). |
| Tests (about 50) | Path constants and JSON imports move to the helper or new relative paths. |
| `changes/unreleased/` | Fragment. |

`scripts/sync_data.ps1` is replaced in **M4b** (section 7), not in the move.

## 6. Tests and verification (once, after the last edit)

1. `npm run schema:generate`, then `npx tsc --noEmit`, `npm run lint`, `npm run docs:check`, `npm run deadcode`.
2. Full `npm test` (a pure move of this width is the one case where the whole suite is the right check), plus `npm run pack:validate -- content/packs`.
3. **Parity:** `npm run simulate` before and after on the same commit base. The card data hash in `logs/simulations/simulation_summary.md`
   (`5425bc2b` on `main` today), the 182-ability coverage and the 20 Gauntlet matches must be identical.
4. New `tests/tools/pack-status.test.ts`: temp content tree with two packs (one with supplemental) gives the expected counts and states.
5. New `tests/tools/content-paths.test.ts`: helper outputs for each location; asserts that every pack folder has a valid `pack.json` and
   that `pack:validate` over `content/packs` returns no findings (this makes the real tree a permanent test of M2).

## 7. M4b: TypeScript sync CLI (separate PR, Q31)

Replace `scripts/sync_data.ps1` with `scripts/content-sync.ts` (`npm run content:sync`): download the upstream archive, write into
`content/.cache/upstream/`, then materialize `content/packs/<code>/cards/`, `content/meta/` (incl. its translations) and each pack's `translations/` from it, preserving each
pack's `pack.json` and `supplemental/`. Cross-platform, diffable (`--check` mode reports changes without writing), reused by M7's in-app
button. Tests use a locally built archive fixture generated in a temp dir.

## 8. Debt Removed

- The flat `data/upstream/pack/` namespace where file names pretend to be pack codes.
- Two path conventions (`data/...` and `src/data/supplemental/pack`) hard-coded in about 30 places.
- About 18 unused upstream helper files tracked in the repository.
- The mixed `src/engine/scenarios/` folder that held content next to engine code.

## 9. UI and Card Editor impact

No visible change. The Card Supplemental Editor reads the same data from the new locations through the helper; its endpoints are unchanged.

## 10. Open decisions

1. **Pack id pattern (decided, Q47).** Loosen `PACK_ID_PATTERN` to `^[a-z][a-z0-9_-]{1,31}$` in `src/data/packs/pack-manifest.ts`, regenerate `pack.schema.json` and update `tests/data/pack-manifest.test.ts` in the M4 PR. The `_encounter` suffix and leading-digit reserved-ID rules are unchanged.
2. **Translations (decided, Q44).** Each pack owns its translations in `packs/<code>/translations/<locale>/`, so no pack is scattered across folders. Catalog-level
   translations (factions, pack names, pack types, sets, subtypes, types) stay with the shared metadata in `content/meta/translations/<locale>/`. Still unused at runtime
   (one test, `tests/engine/i18n-normalization.test.ts`, which moves to the helper's `translationFile`).
3. **All 63 pack folders now (decided, Q46).** All 63 are tracked. Which of them are playable is derived (Q45), not recorded in the folder: `pack:status` for agents, the loader and M7's pack list for users, and `enabledPacks` in `content/config.json` as the sign-off.
4. **`content/meta/` name** for the shared catalog metadata. **Recommend `meta`.**
5. **Merge window (decided: no fixed window).** Before pushing and again before merging, run `gh pr list --state open` and compare the changed files with the renamed paths. On 2026-10-31 there were no open PRs. If one appears, land M4 first and rebase the other branch (git follows the renames); do not hold M4 back.

## 11. Done when

`data/` and `src/data/supplemental/pack/` are gone, every path user goes through the helper, `npm test`, `pack:validate` and `docs:check`
pass, and `npm run simulate` reports the same card data hash and results as before.

## 12. As built (PRs #531 and #535)

Where the merged code differs from the plan above:

1. **The path helper uses `fs`.** `src/tools/content-paths.ts` is described above as "pure path arithmetic"; it also lists pack folders and card or supplemental files (`listPackCodes`, `listCardFiles`, `cardFileNames` and so on), so it is Node only.
2. **`sync_data.ps1` was deleted in M4, not M4b.** Keeping it would have recreated the old `data/upstream` layout. Its replacement, `npm run content:sync`, landed separately in #535 with `--check`, `--from <dir>` and `--prune` (stale files are reported by default). A real run found that GNU `tar` on Windows reads `C:\...` as a remote host; `tar` now runs from inside the cache folder with relative names.
3. **One upstream typo file was dropped.** `translations/it/pack/nrawler_encounter.json` was a byte-identical duplicate of `ncrawler_encounter.json` and belongs to no pack.
4. **Pack ids.** Nine official codes (`sm`, `bp`, `tt`, `cw`, `jj`, `mut_gen`, `next_evol`, `wonder_man`, `luke_cage`) failed the M2 pattern, so `PACK_ID_PATTERN` became `^[a-z][a-z0-9_-]{1,31}$` (Q47). `pack.json` kinds: `core`, `hero`, `scenario` (also for the one `encounter` pack), `mixed` (for `story`).
5. **Also added:** `npm run pack:status` (with a test), `content/README.md`, a `docs-check` skip for the `content` folder, and `content/.cache/` in `.gitignore`.
6. **Parity.** `npm run simulate` output was byte-identical to `main` before and after the move (card data hash `362be14e`), and the full suite passed (447 files, 5,705 tests at the time).
