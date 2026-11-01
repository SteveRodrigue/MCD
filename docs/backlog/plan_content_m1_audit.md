# Plan — M1: Copyright and coupling audit

**Status:** Draft for review (2026-10-31). Read-only audit; its only output is a checklist document.
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md).
**Gate:** none. Can start now (Q6).

## 1. Goal

Produce one authoritative inventory of (a) tracked files that embed official content and (b) code that hard-codes a card
code or pack string, each row assigned to the milestone that removes or reshapes it. The inventory feeds the M8 leak
guard and keeps M3 to M7 from missing a consumer.

## 2. Baseline already gathered (2026-10-31, to be re-verified by the audit)

Counts below come from `git ls-files` and a code sweep; the audit re-runs them and replaces this table with a dated one.

| Area | Tracked | Notes |
| --- | --- | --- |
| `data/upstream/` | 655 files, ~0.9 MB | Vendored MarvelCDB dump: 120 pack files, 4,379 cards (3,995 with official `text`), 5 translation locales, helper scripts. |
| `references/` | 116 files, **~410 MB** | 78 PDFs are ~409 MB. Rules Markdown transcription ~0.8 MB. Tier 1 untracking (M8). |
| `src/data/supplemental/pack/` | 5 files, ~186 KB | 176 cards; `originalText` embeds official text in 101 `core`, 72 `core_encounter`, 1 each in the others. |
| `data/prebuilt_decks/` | 5 files | Core starter decks; single importer `src/engine/decks/starter-decks.ts`. |
| `src/engine/scenarios/` | 14 files | Rhino, Klaw, Ultron plugins and `modular-sets.json`. |
| `src/engine/specials/` | 2 files | Wakanda Forever and the registry. |
| `tests/` | 449 files | 353 contain a card code; 317 use `card-loader`; 37 read supplemental pack JSON; 31 reference upstream; 13 use scenarios. |
| Card images | none tracked | `/cache/` is already gitignored. Good. |
| Leak guard | none | No copyright, art or PDF guard exists in hooks, CI or `tools/audit/`. |

## 3. Hard-coded content in code (audit must re-confirm, then assign owners)

| Location | What | Owner milestone |
| --- | --- | --- |
| `src/engine/specials/wakanda-forever.ts:8` | Black Panther upgrade codes `01046` to `01049` | M5 (move into the Core pack's hook, or data) |
| `src/engine/state/game-setup.ts:169,188` | Fallback villain `01094` and scheme `01097b` | M5 (setup comes from the scenario definition, delete the fallback) |
| `src/engine/scenarios/built-in/klaw/plugin.ts:21,25` | Defense Network `01124` | M5 |
| `src/engine/scenarios/built-in/ultron/plugin.ts:66` | Ultron Drones `01140` | M5 |
| `src/engine/decks/deck-utils.ts:34` | `const pack = 'core'` | M3 |
| `src/engine/simulation/ability-stage-setter.ts`, `scarcity-matchmaker.ts`, `ability-coverage.ts` | `packCode === 'core'` / default `['core']` | M3 (take the pack list from the loader) |
| `src/ui/services/card-cache-service.ts:40` | `startsWith('01')` main-scheme art quirk | M6 (manifest carries naming rule) |
| `src/ui/components/templates/{lab-state,kit-data,template-data,ModalPreviews}.tsx` | Dev-only lab fixtures with real codes | M3 (lab reads from the loader; lab is dev-only, see `tests/tools/lab-dev-only-build.test.ts`) |
| `tools/audit/run-ambiguity-cards-review.ts` | Hard-coded code map | M4 (path helper, Q30) |
| `scripts/cache-card-images.ts`, `src/data/importer/card-loader.ts` | Static import of `core` and `core_encounter` JSON | M3 / M4 |

Comment-only mentions of codes in `src/engine` (about 60 lines in 20 files) are documentation examples. The audit lists them
but marks them "keep" unless the leak guard's text rule flags them (decision in section 7).

## 4. Method

1. Re-run `git ls-files` per area; record file count and bytes. No heuristics for "copyrighted": classify by area.
2. Sweep `src/`, `scripts/`, `tools/`, `tests/` for card codes `\b\d{5}[a-f]?\b` and pack strings (`'core'`, `pack_code`), separating
   functional code from comments and from hex colors (`modal-styles.ts`, `theme-extras.ts` are false positives).
3. Enumerate static importers of `data/upstream`, `data/prebuilt_decks`, `src/data/supplemental`, `src/engine/scenarios`
   (47 non-test files import supplemental modules, most only for types, which stay).
4. Grep docs for quoted card text (8 candidates listed by the baseline; verify each).
5. Draft leak-guard rules (section 5) from the findings and dry-run them against the tree to confirm they flag exactly the
   known official-content areas.

Sub-agents are used only for the wide greps; every flagged line is verified before it enters the checklist.

## 5. Deliverables

| File | Content |
| --- | --- |
| `docs/backlog/content_coupling_audit.md` | The dated inventory, the hard-coded table above (verified), the doc-quote list, and per-row owner milestone. |
| Section 6 of that file | **Leak-guard rule spec for M8**: forbidden path globs (`references/**/*.pdf`, `data/upstream/**` after M12, any `*.png`/`*.jpg` outside an allowlist, `content/.cache/**`), a text rule for `originalText`-style official text, and the allowlist mechanism (mirror `tools/audit/docs-check.allow.json`, entries with `reason` and optional `until`). |

No source, test, data or config changes. `docs/backlog/` is exempt from docs-check path rules but links must resolve.

## 6. Simplification & Refactor Check

- Nothing new is built. The leak-guard spec reuses the docs-check pattern (exported pure `run…(root, options): Finding[]`,
  allowlist JSON, guarded `main`) instead of a second mechanism; M8 will add a rule set to that family rather than a parallel tool.
- The audit table is the single list that M3 to M7 plans cite, replacing ad-hoc greps in each plan.

## 7. Open decisions

1. **Text rule strictness.** `originalText` in supplemental packs and `text` in upstream are official text. At M12 they leave
   with the Core pack. Until then the guard should flag them only **outside** `content/packs/`. **Recommend yes.**
2. **Comment-only card codes** (examples like "Backflip 01003"). **Recommend keep**: codes are identifiers, not content.
3. **`references/` PDFs.** Untracking (M8) leaves 410 MB in history regardless (Q20). **Recommend noting the size in the
   audit so the later history decision has the number.**

## 8. Debt Removed

- Per-milestone guesses about "what else uses real data" are replaced by one verified table.
- Surfaces three hidden hard-codes (`game-setup.ts` fallback, `'core'` strings in simulation, `deck-utils.ts`) that would
  otherwise break the first non-Core boot in M7.

## 9. UI and Card Editor impact

None in M1. The lab fixtures and editor placeholders are listed for later milestones.

## 10. Done when

`docs/backlog/content_coupling_audit.md` exists with verified counts, every hard-coded row has an owner milestone, and the
M8 rule spec is reviewed. `npm run docs:check` clean.
