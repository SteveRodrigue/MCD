# Content coupling audit (M1)

**Date:** 2026-10-31. **Method:** `git ls-files` (1,993 tracked files on `origin/main`), byte sizes from the working tree, ripgrep sweeps of `src/`, `scripts/`, `tools/`, `vite.config.ts`, `tests/`, `docs/`. Read-only; no code changed.
**Parent plan:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md). **Spec:** [`plan_content_m1_audit.md`](plan_content_m1_audit.md).

## 1. Tracked areas that embed official content

| Area | Files | Bytes | Baseline | Verdict |
| --- | --- | --- | --- | --- |
| `data/upstream/` | 655 | 8,118,854 (~8.1 MB) | 655, ~0.9 MB | **Size differs**: baseline was ~0.9 MB, actual is ~8.1 MB (pack 2.6 MB, translations 5.9 MB, root 0.09 MB). Count matches. |
| `data/upstream/pack/` | 120 | 2,610,151 | 120 | 4,379 cards, 3,995 with `text` (match). |
| `data/upstream/translations/` | 5 locales (de 107, es 121, fr 114, it 121, ko 53 files) | ~5.35 MB | "5 translation locales" | match on locales; file counts new. |
| `references/` | 116 | 409,896,746 (~410 MB) | 116, ~410 MB | match. 78 PDFs = 409,126,811 B; 36 Markdown = 668,760 B (~0.7 MB; baseline ~0.8). |
| `src/data/supplemental/pack/` | 5 | 187,398 (~187 KB) | 5, ~186 KB | match. 176 cards (`core` 101, `core_encounter` 72, `aoa_encounter`/`cw_encounter`/`mts` 1 each); every card has `audit.originalText`. |
| `data/prebuilt_decks/` | 5 | 4,422 | 5 | match. Sole importer `src/engine/decks/starter-decks.ts`. |
| `src/engine/scenarios/` | 14 | 31,395 | 14 | match (Rhino, Klaw, Ultron plugin + definition, `modular-sets.json`, plumbing). |
| `src/engine/specials/` | 2 | 6,349 | 2 | match. |
| `src/locales/` | 2 | 35,704 | not in baseline | `en/` and `fr/` `combat-log.json`: UI strings, no card text. No action. |
| `tests/` | 450 | 3,687,498 | 449 | **+1 file**. 360 contain a 5-digit code (baseline 353); 318 use `card-loader` (317); 38 read supplemental pack JSON by path (37); 31 reference `data/upstream` (31); 13 reference `engine/scenarios` (13); 6 reference starter decks. |
| `docs/reports/` | 9 | 125,120 | not in baseline | Generated usage reports: card code, name, type, aspect, pack, ability ids. No printed card text (spot-checked three). |
| Card images / fonts | 0 images | n/a | none | No png/jpg/gif/webp tracked. Only fonts (10 ttf, 43 woff2). `/cache/` is gitignored. |
| Files over 1 MB (non-PDF) | 0 | n/a | n/a | Largest non-PDF tracked file is under 1 MB. |
| Leak guard | none | n/a | none | Confirmed: nothing in `.githooks/`, CI or `tools/audit/` checks PDFs, art or official text. `docs:check` is wired in `.githooks/pre-commit` and `npm run verify`. |

Other places that carry `originalText` (printed text) outside the packs: `src/data/supplemental/schema.json` (schema only), three skill/doc templates under `.agents/skills/`, and 16 `src`/`tests`/`tools` TypeScript files (type definitions, editor, and 3 test fixtures with invented or lightly paraphrased text: `tests/data/supplemental-schema.test.ts:258`, `tests/ui/CardAttributesSection.test.tsx:301,322`).
History size: `references/` keeps ~410 MB in git history after untracking (Q20), recorded here for the later history decision.

## 2. Hard-coded card codes and pack strings in code

Sweep: `\b\d{5}[a-f]?\b` over 313 files in `src/`, `scripts/`, `tools/` (JSON pack data, locales and scenario definitions excluded as data) plus `'core'`, `pack_code`, `packCode`, `startsWith('01')`. Hex-colour false positives (`modal-styles.ts`, `theme-extras.ts`) were excluded by the `#` filter and produce no hits. `vite.config.ts` has no card codes; its only content coupling is the `cache/cards` and `cache/back` directory paths (lines 134 to 197), owner M6.

### 2.1 Functional hits (84 lines total; grouped)

| Location | What | Verdict vs baseline | Owner |
| --- | --- | --- | --- |
| `src/engine/specials/wakanda-forever.ts:8` | `['01046','01047','01048','01049']` Black Panther upgrades | Confirmed | M5 |
| `src/engine/state/game-setup.ts:169` | `catalog.getCard('01094')` fallback villain | Confirmed | M5 |
| `src/engine/state/game-setup.ts:188` | `catalog.getCard('01097b')` fallback main scheme | Confirmed | M5 |
| `src/engine/scenarios/built-in/klaw/plugin.ts:21,25` | `'01124'` Defense Network | Confirmed | M5 |
| `src/engine/scenarios/built-in/ultron/plugin.ts:66` | `'01140'` Ultron Drones | Confirmed | M5 |
| `src/ui/services/card-cache-service.ts:40` | `baseCode.startsWith('01')` main-scheme art quirk (+6 comment lines naming codes) | Confirmed | M6 |
| `src/engine/decks/deck-utils.ts:34` | `const pack = 'core'` in `prebuilt` file naming | Confirmed | M3 |
| `src/engine/simulation/ability-coverage.ts:61` | `filter.packCodes ?? ['core']` default | Confirmed | M3 |
| `src/engine/simulation/ability-stage-setter.ts:125,457,1258,1304,1510` | `c.packCode === 'core'` (5 lines) | Confirmed | M3 |
| `src/engine/simulation/scarcity-matchmaker.ts:93,106,117` | `c.packCode === 'core'` (3 lines) | Confirmed | M3 |
| `src/ui/components/templates/ModalPreviews.tsx` | 19 lines of real codes (01001a, 01094, 01102, 01050, 01007) | Confirmed (lab) | M3 |
| `src/ui/components/templates/kits/kit-data.ts` | 12 lines (01001a, 01094, 01102, 01050, 01003, 01007, 01075, 01059, 01066, 01083) | Confirmed (lab) | M3 |
| `src/ui/components/templates/lab-state.ts` | 13 lines (01001a/b, 01005, 01050, 01007, 01008, 01003, 01075, 01059, 01066, 01094, 01102) | Confirmed (lab) | M3 |
| `src/ui/components/templates/template-data.ts` | 16 lines, incl. `01043a` Wakanda Forever and `01046` to `01049` | Confirmed (lab); Wakanda codes repeated here | M3 |
| `tools/audit/run-ambiguity-cards-review.ts:40-129` | 8 card-code keys; `:9-12` core pack file paths; `:174` default `'core'` | Confirmed | M4 (path helper, Q30) |
| `src/data/importer/card-loader.ts:578,579` | static import of `data/upstream/pack/core.json` and `core_encounter.json` | Confirmed | M3 |
| `scripts/cache-card-images.ts:4,5` | static import of the same two upstream files | Confirmed | M4 (and M6) |
| `src/data/supplemental/index.ts:3-7` | static import of 5 supplemental pack JSON files | **Missed by plan** (registry assembly) | M3 |
| `src/engine/decks/starter-decks.ts:12-16` | static import of 5 prebuilt deck JSON files | Plan lists importer, not as a row | M3 |
| `src/engine/scenarios/modular-sets.ts:2`, `scenarios/index.ts:2-4` | static import of `modular-sets.json` and Rhino/Klaw/Ultron plugins | **Missed by plan** | M3 (modular sets) / M5 (plugins) |

Editor and doc placeholder strings (example hints, no functional effect): `src/data/supplemental/effect-params.ts:280`, `schema-primitives.ts:309`, `schema.json:114` (generated from the primitives, so edit the source), `CardFilterToolbar.tsx:248`, `CardLocationSelectorForm.tsx:161`, `DynamicValueBuilder.tsx:470`, `GateParamsPanel.tsx:110`, `UniversalCardFilterBuilder.tsx:208`, `schema-form/RecipientField.tsx:57`, `tools/audit/card-text-parser.ts:166`. Owner: M9 (editor refactor), low priority; they are examples, not logic. The leak-guard text rule must not flag them (section 6).

### 2.2 Hard-codes the plan missed

| Location | What | Owner |
| --- | --- | --- |
| `src/engine/state/game-setup.ts:168,187,211,231` | Default scenario id `'rhino'` (4 lines) | M5 |
| `src/engine/pipeline/scenario-helpers.ts:11,31` | `state.scenarioId \|\| 'rhino'` | M5 |
| `src/engine/simulation/ability-stage-setter.ts:192`, `simulation/gauntlet.ts:127`, `simulation/rule-scenarios.ts:561` (`'ultron'`), `scripts/simulate-games.ts:166` | Default or fixed scenario id | M5 (Q17 gate uses seeded Rhino; keep as an explicit argument) |
| `src/ui/components/setup/ScenarioSelector.tsx:53` | Initial selection `'rhino'` (will break on a zero-pack boot) | M7 |
| `src/ui/components/templates/lab-state.ts:33`, `src/ui/components/board/villain-zone-utils.ts:8`, `src/ui/utils/comic-log-formatter.ts:106-108,137-139` | `'rhino'`/`'klaw'`/`'ultron'` names for labels and icons | M7 (labels from manifest) |
| `tools/audit/card-text-parser.ts:51,53,66,94,177,272` | `packCode = 'core'` default and `data/upstream/pack`, `src/data/supplemental/pack` paths | M4 (path helper) |
| `tools/audit/{get-card-data,audit-phase-triggers,supplemental-declarations-analyzer,migrate-declarative-taxonomy,schema-member-coverage}.ts`, `tools/migrate-supplemental-to-steps.ts`, `scripts/extract-card.ts:10,11` | Path constants to `data/upstream/pack` and `src/data/supplemental/pack`; `schema-member-coverage.ts:213,214` names `core.json`, `core_encounter.json`; `supplemental-declarations-analyzer.ts:249` defaults `'core'` | M4 (path helper, Q30) |
| `scripts/sync_data.ps1:10`, `.githooks/pre-commit:16` | Writes `data/upstream`; hook triggers on `data/upstream/` | M4 (TS sync CLI, Q31; hook path update) |
| `src/tools/editor/api-middleware.ts` | Reads upstream and writes `src/data/supplemental/pack/<pack>.json` through the Vite middleware | M9 (Q24 deletes it) |

### 2.3 Comment-only hits

53 lines in 22 files. Per file: `trigger-dispatcher.ts` 7, `stat-calculator.ts` 6, `card-cache-service.ts` 6, `cost-engine.ts` 5, `villain-phase.ts` 4, `boost-resolution.ts` 3, `models/state.ts` 3, `combat.ts` 2, `target-choice.ts` 2, `combat-pipeline.ts` 2, `legality-checker.ts` 2, and 1 each in `gate-params.ts`, `effects/index.ts`, `step-selection.ts`, `abilities.ts`, `damage-immunity.ts`, `target-restrictions.ts`, `card-inspector.ts`, `klaw/plugin.ts`, `ultron/plugin.ts`, `SupplementalEditorScreen.tsx`. Baseline said about 60 lines in 20 files (engine only); the sweep now includes `src/data` and `src/ui`. Decision: keep (codes are identifiers).

## 3. Static importers

| Target | Non-test importers | Test files |
| --- | --- | --- |
| `data/upstream` | `src/data/importer/card-loader.ts` (2 imports); `scripts/cache-card-images.ts` (2); path-read (fs) by `scripts/extract-card.ts`, `tools/audit/{audit-phase-triggers,card-text-parser,get-card-data,supplemental-declarations-analyzer}.ts` | 31 files match `data/upstream` (card-loader, supplemental guards/schema, engine setup tests) |
| `data/prebuilt_decks` | `src/engine/decks/starter-decks.ts` (5 imports) | `tests/engine/starter-decks.test.ts` (6 files mention starter decks) |
| `src/data/supplemental/pack/*.json` | `src/data/supplemental/index.ts` (5 imports); path-read by `scripts/extract-card.ts`, `tools/audit/{card-text-parser,get-card-data,migrate-declarative-taxonomy,run-ambiguity-cards-review,schema-member-coverage,supplemental-declarations-analyzer}.ts`, `tools/migrate-supplemental-to-steps.ts`, `src/tools/editor/api-middleware.ts` | 38 files match `supplemental/pack` or `pack/core*.json` |
| `src/data/supplemental` (any module) | 61 non-test files import a path containing `supplemental`; most are type-only and stay. Baseline said 47 (narrower pattern). | n/a |
| `src/engine/scenarios` | `scenarios/index.ts` imports the three built-in plugins; `modular-sets.ts` imports `modular-sets.json`; consumers `pipeline/scenario-helpers.ts`, `ui/components/setup/ScenarioSelector.tsx` | 13 files |

Tests that import card data are by pattern (`card-loader`, `data/upstream`, `supplemental/pack`): 318, 31 and 38 files. Per Q14 they move to the `ContentLoader` in M3/M4; list from `rg -l "card-loader|data/upstream|supplemental/pack" tests`.

## 4. Docs quoting official card text

Candidates came from a sweep for `originalText`, `"text":`, and ability-keyword quotes across `docs/` (excluding `docs/backlog/`), then each was read.

| File | Quotes official text? | Detail |
| --- | --- | --- |
| `docs/algorithmic_rules_reference.md:460` | **Yes** | Rhino Stage II When Revealed, in quotation marks. |
| `docs/ambiguities/mts_21054_eternity.md:13` | **Yes** | Full printed text of Eternity under "Official Printed Text". Ambiguity files are by design card-specific. |
| `docs/decisions/0060-gate-and-effect-params-separation.md:15` | **Yes** | Explosion `01111` When Revealed, quoted. |
| `docs/decisions/0055-universal-ability-resource-payment-and-action-verb-unification.md:12` | **Yes (partial)** | Italic fragment of Enhanced Ivory Horn `01100`'s Hero Action. |
| `docs/specifications/supplemental/01_metadata_and_audit.md:120` | **Partial** | Example `originalText` "Spider-Sense, Interrupt: When the villain initiates an attack against you, draw 1 card", close to a real card. |
| `docs/specifications/tooling/card_supplemental_editor.md:140` | No | Truncated generic example ("When the villain initiates an attack..."). |
| `docs/specifications/supplemental/QUICK_REFERENCE.md:20` | No | Placeholder "Exact printed card text here". |
| `docs/guidelines/hero_creation_guide.md:73-201` | No | Invented Daredevil homebrew cards. |
| `docs/decisions/0021`, `0059`, `0067`, `docs/tools/card_text_parser.md`, `docs/specifications/supplemental/08_effects_villain_nemesis.md:245,255` | No | Mention the field name or paraphrase RR rules; no card text. |
| `docs/roadmap_and_milestones.md:353` | No | Generic "Action: Ask another player to..." feature wording. |
| `docs/reports/**` (9 files) | No | Codes, names, types, ability ids only. |

Card **codes and names** appear widely in docs (for example 276 code mentions in `timing_and_triggers_usage.md`, 35 in `roadmap_and_milestones.md`); these are identifiers and follow the plan's "keep" decision. Verbatim-text docs to rewrite or relocate with the Core pack: the four "Yes" rows above (M10 / M12).

## 5. Findings versus the plan baseline

1. `data/upstream/` is ~8.1 MB, not ~0.9 MB (translations are ~5.9 MB of it).
2. `tests/` has 450 files and slightly higher pattern counts (360 / 318 / 38).
3. Supplemental importers are 61 by the broad pattern (baseline 47).
4. Missed hard-codes: default scenario id `'rhino'` in about 12 places, `src/data/supplemental/index.ts` and `starter-decks.ts` static imports, `scenarios/index.ts` plugin imports, 10+ `tools/` and `scripts/` path constants, `.githooks/pre-commit:16`, `ScenarioSelector.tsx:53`, `template-data.ts` Wakanda codes, `vite.config.ts` cache dirs.

## 6. Leak-guard rule spec for M8

Mechanism: `tools/audit/leak-guard.ts`, same shape as `tools/audit/docs-check.ts`: exported pure `runLeakGuard(root, options): Finding[]` (`Finding` = `{file, line, check, message}`), guarded `main`, wired as `npm run leak:check` into `.githooks/pre-commit` and `npm run verify`. Input is `git ls-files` so ignored files never count.

**Path rules (forbidden tracked paths)**

| Rule id | Glob | Dry-run flags today |
| --- | --- | --- |
| `pdf` | `**/*.pdf` | 78 files, all in `references/` (409.1 MB) |
| `image` | `**/*.{png,jpg,jpeg,gif,webp,avif,bmp,tiff}` | 0 (only fonts are tracked, not matched) |
| `cache` | `cache/**`, `content/.cache/**` | 0 |
| `upstream` | `data/upstream/**` (becomes `content/.cache/upstream/**` at M4; forbidden after M12) | 655 files, so keep it **disabled until M12**, enable by an `until` date or phase flag |
| `size` | any tracked non-allowlisted file over 5 MB | 0 non-PDF; the 78 PDFs are caught by `pdf` |

**Text rule**: flag the JSON key `"originalText"` and the upstream-card signature (a JSON file with both `"pack_code"` and `"text"` keys) in any tracked file outside `content/packs/**` and, until M4, outside `src/data/supplemental/pack/**` and `data/upstream/**`. Scope: `*.json` only; Markdown and TypeScript are ignored (docs and type definitions legitimately name the field).
Dry run, JSON only: `"originalText"` is present in 6 JSON files, 5 of them the exempt supplemental packs; the other is `src/data/supplemental/schema.json` (generated schema, add an allowlist entry). `"pack_code"` appears in 150 JSON files: 120 in `data/upstream/pack`, 29 in `data/upstream/translations/{de,es}/pack`, 1 in `data/upstream/schema`; all under the exempt upstream area. Today's net flags with the exemptions applied: 1 (`schema.json`), which the allowlist absorbs. With the exemptions removed (post-M12 view): 6 and 150 files.
Rejected alternatives: a free-text heuristic over Markdown (false positives on 16 TS files and 4 docs that quote text on purpose).

**Allowlist**: `tools/audit/leak-guard.allow.json`, array of `{ "check": "<rule id>", "value": "<exact path or glob>", "reason": "<why>", "until": <issue number, optional> }`, identical to `AllowEntry` in `docs-check.ts`. A closed `until` issue turns the entry into a finding. Initial entries: `text` rule for `src/data/supplemental/schema.json`; the `references` PDFs while M8 untracking is pending (`until` the M8 issue). No entry may be added without a `reason`.

**Done check for M8**: the guard exits 0 on `main` after M8 with `pdf`, `image`, `cache`, `size` enabled and `upstream` enabled only once M12 lands.
