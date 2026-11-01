# Plan — M10: Documentation is split by audience, and a creator can build a first pack from it

**Status:** draft 2026-11-01, revised after Steve's rule that deprecated and historical documents are not kept (decision 4: delete). Waiting for review (open decisions in section 9).
**M10a:** merged (#555). **M10b:** implemented (creator docs, tested example pack `first-pack`, `creator-field` check, welcome pointer). The pack id is `first-pack` (the card schema limits `pack_code` to 10 characters, so `my-first-pack` was too long).
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (Q7, Q32, Q35; section 3.8; roadmap row M10) and [ADR-0092](../decisions/0092-content-packs-and-runtime-loading.md).
**Depends on:** M2 to M9 (the pack format, loader, scenarios as data and the editor are all merged). Independent of M11 and the parked desktop app (#548).
**Gate note:** Gate 1 (Rhino) is active. M10 touches documentation, one test and `tools/audit/docs-check.ts`. The one `src/` change is a line of text on the welcome screen (section 3.5).

## In-Game Scenario

In-Game Scenario: none (documentation; the game plays the same).

**Creator scenario (stands in for it):**
**Setup:** A fan with a fresh clone wants to make a hero pack. They know JSON, not this codebase.
**Does:** Opens the welcome screen, reads "see `docs/creators/README.md`", follows the first-pack tutorial: copies `docs/creators/examples/first-pack/` into `content/packs/`, adds its id to `enabledPacks`, reloads.
**Today:** The material exists but is scattered by author, not by reader: the hero guide and scenario guide sit in `docs/guidelines/` and still describe pre-pack paths (`src/data/supplemental/`, "built-in heroes"); the supplemental reference is under `docs/specifications/`; the editor spec describes an API that M9 deleted; nothing explains what a pack is, `pack.json`, `dependsOn`, or how to install one. The welcome screen points nowhere.
**After this change:** `docs/creators/` starts with "what is a pack" and a tutorial whose example pack is tested: a test loads it through the real loader and `pack:validate`, so the tutorial cannot rot. The Content screen then lists the pack as **Data only** (it ships cards without supplemental data) and a second step of the tutorial adds one supplemental entry through the editor, turning it **Playable**. Engine-facing material lives in `docs/engine/`.
**Why (rules):** None. This is about who the documents are for (Q32).

## 1. Goal

After M10 there are two doors into the documentation: `docs/creators/` for someone making content, `docs/engine/` for someone changing the engine. Every creator-facing schema field is documented and a mechanical check says so. The old locations are gone, not redirected (no dual paths).

## 2. Facts (verified 2026-11-01 on `main`)

- **158 Markdown files under `docs/`.** Audience split of the current ones:
  - Creator material: `docs/guidelines/hero_creation_guide.md` (397 lines), `docs/guidelines/scenario_creation_guide.md` (187), the supplemental suite `docs/specifications/supplemental/` (README, 11 modules, QUICK_REFERENCE; about 2,800 lines), `docs/specifications/supplemental_data_schema.md` (23-line pointer to the suite), `docs/specifications/tooling/card_supplemental_editor.md`.
  - Engine material: `docs/architecture.md` (358), `docs/algorithmic_rules_reference.md` (488), `docs/coding_guidelines.md` (381), `docs/tools/*.md` (2), `docs/specifications/content_plugins_scenarios_and_campaigns.md` (262 lines; most of its decision table and sections are marked superseded by ADR-0092, and M9 added two more "superseded" notes to it).
  - Project and history, unchanged: `docs/decisions/` (94 ADRs), `docs/backlog/`, `docs/reports/`, `docs/ambiguities/`, `docs/templates/`, `docs/roadmap_and_milestones.md`.
- **Who points at the old paths** (files mentioning them, `main`): `docs/specifications/supplemental` 17, `docs/guidelines` 10, `docs/specifications/tooling` 5, `docs/coding_guidelines` 17, `docs/algorithmic_rules_reference` 10, `docs/architecture.md` 2, `docs/tools/` 5. They include `README.md`, `AGENTS.md`-linked rules, five skills, three ADRs, `tests/data/quick-reference-sync.test.ts` (reads `QUICK_REFERENCE.md` by path) and `tools/audit/docs-check.ts` (`isCurrent` lists `docs/specifications/`, `docs/guidelines/`, `docs/tools/` and three files by path). `docs/reports/`, `docs/backlog/` and `CHANGELOG.md` are history and keep the paths they were written with (`docs-check` skips them).
- **`docs:check` today** checks links, paths, scripts, symbols, ADR index, orphans, tombstones, volatile numbers and the roadmap; "current" documents are the ones in `isCurrent`. There is no check that a schema field is documented, except `quick-reference-sync` for the supplemental suite.
- **Stale content found while reading:** the hero guide still says base cards live in `content/` and supplemental in `src/data/supplemental/`, and talks about "built-in heroes"; the editor spec had to be rewritten by M9 and still sits under `specifications/tooling/`.
- **The tools a creator uses already exist:** `npm run pack:validate`, `pack:status`, the editor at `/editor`, the Content screen (M7).
- **The pack format is defined in code and a generated schema:** `PackManifestSchema` (`src/data/packs/pack-manifest.ts`), `pack.schema.json`, `ScenarioDefinitionSchema`, `PackDeckSchema`, `ModularSetsSchema`.
- **No example pack exists.** Core is the only complete pack and is far too large to teach from.

## 3. Design

### 3.1 The new tree

```text
docs/
  creators/
    README.md                  # what a pack is, the 10-minute tutorial
    pack-format.md             # pack.json, folder layout, ids and codes, dependsOn, origin, art
    cards-and-heroes.md        # was guidelines/hero_creation_guide.md, rewritten for packs
    scenarios.md               # was guidelines/scenario_creation_guide.md
    supplemental-reference/    # was specifications/supplemental/ (README, 01..11, QUICK_REFERENCE)
    editor.md                  # how to use /editor (new, short, task oriented)
    sharing-and-installing.md  # folders and zip today; what is not built yet
    examples/first-pack/    # the tested example (3.3)
  engine/
    architecture.md  algorithmic_rules_reference.md  coding_guidelines.md
    tools/  (card_text_parser.md, supplemental_schema_validation.md)
    editor-architecture.md     # was specifications/tooling/card_supplemental_editor.md (data flow, write rule)
  decisions/  backlog/  reports/  ambiguities/  templates/  roadmap_and_milestones.md   # unchanged
```

`docs/specifications/` and `docs/guidelines/` are emptied and removed. `supplemental_data_schema.md` (a pointer page) is deleted; its readers go to `creators/supplemental-reference/README.md`. `content_plugins_scenarios_and_campaigns.md` is deleted, not moved (Steve: deprecated and historical documents are not kept). Anything in it that is still true already lives in ADR-0092, `content/README.md`, `creators/pack-format.md` and `creators/scenarios.md`; the implementation checks each remaining section against those before deleting, and moves a still-true fact into the right document instead of keeping the file. Its inbound links (README, ADR-0092) are removed or pointed at ADR-0092.

### 3.2 Moves are moves

Every relocation is a `git mv` so history follows. All inbound links (the 21 or so files above, including ADRs, skills and `README.md`) are updated in the same PR, and `docs:check` proves none is left dead. No stub files stay behind.

### 3.3 The example pack and its test

`docs/creators/examples/first-pack/` holds a real pack: `pack.json` (origin `user`), one hero with the standard card fields in `cards/`, nothing else, so it shows up **Data only**. A test (`tests/data/creators-example-pack.test.ts`) copies it into a temp content root, loads it with the real loader (zero failures, the card is in the catalog, state **Data only**) and runs `pack:validate` on it. The tutorial's second part adds a supplemental entry for the hero and the same test proves the pack becomes **Playable** with that file (the file is shipped as `supplemental.sample.json` beside the pack, copied in by the test).

### 3.4 Documentation completeness check

`docs-check` gets one new check, `creator-field`: every property of `PackManifestSchema` appears in `creators/pack-format.md`, and every top-level property of `ScenarioDefinitionSchema` appears in `creators/scenarios.md`. This is the "Synchronous Documentation Mandate" made mechanical for the two schemas that have no sync test yet. The existing `quick-reference-sync` test keeps covering the supplemental suite (path updated).

### 3.5 The welcome screen points at the docs

`WelcomeScreen` already says "Pick one way to get some"; it gains one line, "To make your own pack, read `docs/creators/README.md`" (plain text, as the plan promised in M7). English only, like the rest of that screen.

### 3.6 Vocabulary

Pack for content, hook for code (Q35). While rewriting, "plugin" is replaced in prose except the `ScenarioPlugin` interface name, "built-in" and "custom" heroes become "Core pack" and "user pack".

### 3.7 Not in M10

New schema documentation for things that do not exist (zip import, sandboxed pack code), translations of the docs, a documentation website, any change to ADR contents (ADR-0092 gets only link fixes).

## 4. Simplification & Refactor Check

- The tree has one place per audience instead of three overlapping folders (`guidelines`, `specifications`, `tools`).
- The 23-line pointer page and the superseded plugins design document are deleted, not carried over or marked historical.
- `docs-check`'s hard-coded `isCurrent` list becomes two prefixes (`docs/creators/`, `docs/engine/`) plus the two files that stay.
- The tutorial is executable (tested), so there is one example instead of prose that drifts.

## 5. Debt Removed

- `docs/guidelines/`, `docs/specifications/`, the pointer page `supplemental_data_schema.md` and the superseded `content_plugins_scenarios_and_campaigns.md` (with the "superseded by M9" notes M9 left in it).
- Pre-pack paths and "built-in hero" wording in the hero guide; the editor description that M9 made false.
- `docs-check`'s per-folder `isCurrent` list.
- The welcome screen's missing pointer to creator docs.

## 6. File changes

| File | Change | Serves |
| --- | --- | --- |
| `docs/guidelines/*.md` to `docs/creators/cards-and-heroes.md`, `scenarios.md` | [MOVE] and update paths | Creator scenario |
| `docs/specifications/supplemental/**` to `docs/creators/supplemental-reference/` | [MOVE] | Creator scenario |
| `docs/specifications/tooling/card_supplemental_editor.md` to `docs/engine/editor-architecture.md` | [MOVE] | Engine docs |
| `docs/specifications/content_plugins_scenarios_and_campaigns.md` | [DELETE] after moving any still-true fact into the creator or engine docs | Debt Removed |
| `docs/architecture.md`, `algorithmic_rules_reference.md`, `coding_guidelines.md`, `tools/*.md` | [MOVE] to `docs/engine/` | Engine docs |
| `docs/specifications/supplemental_data_schema.md` | [DELETE] | Debt Removed |
| `docs/creators/README.md`, `pack-format.md`, `editor.md`, `sharing-and-installing.md` | [NEW] | Creator scenario |
| `docs/creators/examples/first-pack/**` | [NEW] | Creator scenario |
| `README.md`, `AGENTS.md`-linked rules, 5 skills, 3 ADRs (ADR-0092 also drops its citation of the deleted plugins document), other inbound links | [MODIFY] link targets | Debt Removed |
| `tools/audit/docs-check.ts`, `tests/tools/docs-check.test.ts` | [MODIFY] `isCurrent`, `creator-field` check | Completeness |
| `tests/data/quick-reference-sync.test.ts` | [MODIFY] path | Completeness |
| `tests/data/creators-example-pack.test.ts` | [NEW] | Creator scenario |
| `src/ui/components/setup/WelcomeScreen.tsx` and its test, `changes/unreleased/*.md` | [MODIFY]/[NEW] one line and a fragment | Welcome pointer |

## 7. UI and Card Editor

UI: one line on the welcome screen (3.5). Card Supplemental Editor: no code change; `creators/editor.md` documents it.

## 8. Tests

- `tests/data/creators-example-pack.test.ts`: the example loads with zero failures and is **Data only**; with the sample supplemental file it is **Playable**; `pack:validate` passes.
- `tests/tools/docs-check.test.ts`: the `creator-field` check flags a manifest property missing from `pack-format.md` (temp tree) and passes on the repository.
- `tests/data/quick-reference-sync.test.ts` passes at the new path.
- `npm run docs:check` clean over the new tree (the done check); the existing welcome screen test gains the pointer assertion.

## 9. Open decisions

1. **Two PRs** (recommended): 10a is the mechanical move plus link and `docs-check` fixes (reviewable by rename detection); 10b is the new creator documents, the tested example pack, the new check and the welcome screen line. One PR would bury the new text in a 100-file rename.
2. **Move the three big engine documents** (`architecture`, `algorithmic_rules_reference`, `coding_guidelines`) **into `docs/engine/`** (recommended, matches section 3.8 of the parent plan). Cost: about 30 inbound links, mostly in skills and rules. Alternative: leave them at the top of `docs/` and move only the creator material.
3. **The example pack lives in `docs/creators/examples/`, not in `content/packs/`** (recommended: it must not ship in the game's content folder or appear in a fresh install). The tutorial has the reader copy it.
4. **Answered (Steve, 2026-11-01): deprecated and historical documents are not kept.** The plugins design document is deleted, not moved, and nothing in the new tree is labelled "historical" or "superseded".
5. **English only**; no translation of the documentation.
