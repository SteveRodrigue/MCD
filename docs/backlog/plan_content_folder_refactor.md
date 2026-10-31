# Plan — Content Folder Refactor ("empty shell" engine)

**Status:** Draft for review (2026-10-30). Planning only; no code changes.
**Origin:** Steve's draft ideas (unified content folder, packs own their scenarios, community docs, empty-shell boot).
**Relationship to existing docs:** This plan **extends and partly supersedes**
[`docs/specifications/content_plugins_scenarios_and_campaigns.md`](../specifications/content_plugins_scenarios_and_campaigns.md)
(the "plugins" backlog, decisions Q1–Q14) and builds on
[ADR-0006](../decisions/0006-local-first-card-data-architecture.md) (local-first data),
[ADR-0011](../decisions/0011-card-orientation-and-art-caching.md) (art caching) and
[ADR-0015](../decisions/0015-user-content-and-deck-storage-architecture.md) (user content storage).

---

## 0. Scope decision (2026-10-31): Tier 2

Decided with Steve after checking licensing: the `zzorba/marvelsdb-json-data` repo carries no license (its `package.json`
says ISC, but that is npm boilerplate covering helper scripts, not card data), so the card data stays a gray area either way.

- **Tier 1 (included):** untrack the PDFs in `references/` and the Markdown conversions of the Rules Reference, and add a leak guard
  that blocks official art and PDFs from being committed. Images stay runtime-fetched into a gitignored cache, as today.
- **Tier 2 (the target of this plan):** card data, supplemental data, scenarios, decks and modular sets are **reorganized into a
  Core pack inside this repo** and loaded at runtime. The engine boots as an empty shell when no pack is present.
- **Tier 3 (deferred):** physically removing the Core pack from the repo (untrack, ignore, sync command, optional history
  rewrite). Tier 2 is designed so this is a small mechanical step later.
- **Test fixtures are deliberately out of scope until tier 3.** While the Core pack stays in the repo, the existing tests keep
  using it. Once the Core pack is dropped from the repo the tests that need it will fail, and that problem (original fixture
  packs, an opt-in official-data suite) is planned only when and if M12 is crossed. Note for then: players may own only part of
  the collection, so pack-dependent engine features will need to work against partial content.

Consequences for the rest of this document: milestone **M8** becomes "Tier 1 leak guard and reference untracking" (the removal of
the Core pack is a future milestone, **M12**); Open Questions 1 and 2 are parked until tier 3; Question 8 is answered (untrack
`references/` PDFs).

### Decision log

| # | Question | Decision (date) |
| --- | --- | --- |
| Q3 | Runtime vs build-time loading | **Runtime for data, build-time for trusted code hooks** (2026-10-31) |
| Q4 | Code in user packs | **JSON only now; sandboxed code later** via a future ADR (2026-10-31) |
| Q5 | Platforms | **Dev server + Tauri desktop first**; browser zip-import later. Note: Tauri is advertised in the README but `src-tauri/` does not exist yet, so its setup becomes its own milestone (2026-10-31) |
| Q6 | Timing vs gates | **Plan now, build after Gate 1**: M0 to M2 run now (no behavior change); loader work (M3+) starts after the Rhino release (2026-10-31) |
| Q7 | Scenario Editor | **Postponed**; scenarios are hand-written JSON for now, so scenario-authoring docs and schema validation are mandatory. Official scenarios (Rhino, Klaw, Ultron) must be integrated through the same plugin/pack format. M9 keeps only the Card Supplemental Editor refactor (2026-10-31) |
| Q10 | Raw card format | **Keep zzorba/MarvelCDB JSON** as the pack card format (2026-10-31) |
| Q9 | Folder name and shape | **`content/` root with `packs/<id>/`, `decks/` and `.cache/`** (2026-10-31) |
| Q9b | Official precon decks | **Inside each pack** (`packs/<id>/decks/`, read-only). User decks in `content/decks/`, MarvelCDB imports in `content/decks/imported/` (read-only cache, cloneable; replaces ADR-0015's `marvelcdb/`). Deck picker shows Official / Mine / Imported together (2026-10-31) |

---

## 1. The key finding: the existing plugins design assumes the opposite of an empty shell

The earlier plugins backlog already designs a pack-as-a-package model (`plugins/official/<pack>/`, `plugins/custom/<mod>/`,
manifest, `cards/`, `scenarios/`, `scripts/`, `assets/`). That is most of what the draft asks for. But three of its decisions
conflict with the new goal:

| Earlier decision | Conflict with "empty, copyright-free shell" |
| --- | --- |
| **Q5** official content lives in the repo at `plugins/official/` | Official content is exactly what must **not** ship in the shell. |
| **Q3 / Q4** build-time only; codegen bundles every pack into the app | The shell cannot know its content at build time; users add content after install. Needs **runtime discovery and loading**. |
| **Q9** `plugin.ts` scripts compiled and type-checked in the bundle | Runtime-loaded user packs cannot run arbitrary TypeScript safely. Needs a declarative-only or sandboxed story for user packs. |

So the refactor is really two moves: (1) the pack layout (mostly designed already) and (2) **flip from build-time to runtime
content**, with official content treated as just another pack that the user's machine obtains, not the repo.

---

## 2. Current state (what has to move)

Copyright-sensitive or content-coupled material currently committed to the repo:

| Area | Where | Notes |
| --- | --- | --- |
| Upstream card data (zzorba) | `data/upstream/` (120 pack files, ~9 MB incl. translations, schema, Python/PHP helpers) | Pristine copy of `marvelsdb-json-data`, refreshed by `scripts/sync_data.ps1`. |
| Supplemental (MCD rules JSON) | `src/data/supplemental/pack/` (`core`, `core_encounter`, `aoa_encounter`, `cw_encounter`, `mts`) | Declarative behavior keyed by card code; statically imported in `src/data/supplemental/index.ts`. |
| Prebuilt decks | `data/prebuilt_decks/` (5 Core starter decks) | Used by `src/engine/decks/starter-decks.ts`. |
| Scenarios | `src/engine/scenarios/built-in/{rhino,klaw,ultron}/` (`definition.json`, `plugin.ts`, README) | Registered statically in `src/engine/scenarios/index.ts`. Rhino has no `plugin.ts` logic (declarative); Klaw/Ultron keep code. |
| Modular set catalog | `src/engine/scenarios/modular-sets.json` | Bomb Scare, Masters of Evil, etc. |
| Card-specific code | `src/engine/specials/` (e.g. Wakanda Forever) | Registered by card code. |
| Card images | `cache/` (**gitignored**), fetched from `marvelcdb.com/bundles/cards` | Already the right pattern: never committed. Logic in `src/ui/services/card-cache-service.ts`, `scripts/cache-card-images.ts`, and the dev middleware in `vite.config.ts`. Includes a Core Set-specific main-scheme filename quirk keyed on the `01` prefix. |
| Rules text | `references/` (RR v1.8 PDF + structured Markdown, campaign rulebooks) | Probably also copyrighted; see open questions. |
| Static content wiring | `src/data/importer/card-loader.ts`, `scripts/cache-card-images.ts`, `ScenarioSelector` (defaults to `'rhino'`), `tests/**` (40+ files import upstream or supplemental paths directly; 260+ engine tests assume real Core data) | All assume content is always present. |
| Editor | `src/ui/components/editor/*` + `src/tools/editor/api-middleware.ts` | A **Card Supplemental Editor**. It works through a Vite dev-server middleware that writes files, so it only works in `npm run dev`. |
| Docs | `docs/guidelines/{hero,scenario}_creation_guide.md`, `docs/specifications/supplemental/*` (11 files), `…/tooling/card_supplemental_editor.md`, plugins backlog, ADRs | Creator-facing and engine-internal docs are mixed. The scenario guide still points at `src/engine/scenarios/built-in|custom/`. |

Things that are **already in good shape**: images are not committed; the engine is headless; scenarios already share one
format (`definition.json` + optional plugin) for official and custom; a declarative base class exists
(`DeclarativeScenarioPlugin`); the supplemental schema is generated and validated.

---

## 3. Target architecture

### 3.1 Content folder layout

One root, `content/` (name is an open question), holding **packs**. Official and user packs have the same structure; only
their *origin* and *mutability* differ (recorded in the manifest and enforced by the loader).

```text
content/
  packs/
    core/                               # origin: "official-sync"  (read-only to the editor)
      pack.json                         # { id, name, kind, origin, apiVersion, version, dependsOn[], license/source }
      cards/
        core.json                       # raw cards, zzorba/marvelsdb format (pristine, from sync)
        core_encounter.json
      supplemental/
        core.json                       # MCD behavior overlay, mirrors cards/ 1:1
        core_encounter.json
      scenarios/
        rhino/  definition.json (+ README.md)
        klaw/   definition.json (+ optional script)
        ultron/ definition.json (+ optional script)
      modular-sets.json                 # moves out of the engine
      decks/                            # starter/prebuilt decks for this pack
      scripts/                          # official-only code hooks (see 3.4)
      assets/                           # origin-specific art, see 3.3
    my-hero-pack/                       # origin: "user"  (editable)
      pack.json
      cards/raw.json                    # codes prefixed "<packId>-0001"
      supplemental/my-hero-pack.json
      scenarios/…
      assets/cards/<code>.png
  decks/                                # user-built decks (editable)
    imported/                           # MarvelCDB imports (read-only cache, cloneable)
  .cache/                               # gitignored, disposable
    images/<packId>/…                   # MarvelCDB-fetched art
    upstream/…                          # raw sync downloads
```

Why per-pack folders rather than ADR-0015's `fan_made_heroes/` and `fan_made_scenarios/`: a hero, its signature
modular set and a scenario that uses them are routinely released together. The pack is the unit of distribution
(zip/folder), dependency (`dependsOn: ["core"]`) and ownership of scenario code. ADR-0015 would need a short
superseding ADR (see M0).

### 3.2 Official content: sync, never commit

"Official" packs are built on the user's machine by a **content sync** (CLI first, in-app later):

1. Download the zzorba dataset into `content/.cache/upstream/` (replaces `scripts/sync_data.ps1`).
2. Materialize `content/packs/<code>/cards/` from it (a pristine pack per upstream pack).
3. Fetch the MCD **supplemental + scenarios + decks** for each pack from a separate source (see Open Question 1),
   because these are MCD's own work and must be versioned and reviewable even though they are derived from card text.
4. Images are fetched lazily from MarvelCDB into `content/.cache/images/` exactly as today (on first display, deduped,
   atomic temp-file rename). The pack manifest, not `'01'` string checks in UI code, carries the image-naming quirk.

The repo then ships **zero** upstream data and **zero** pack supplemental/scenario content. `content/` is gitignored
(except a `README.md` and `.gitkeep` once the Core pack is decoupled in M12; until then the Core pack stays tracked).

### 3.3 Scenarios live with their packs

- A scenario is `scenarios/<id>/definition.json` inside its pack. The Core Set pack owns Rhino, Klaw, Ultron; each
  references the pack's `cards/` and `supplemental/` data (and `dependsOn` other packs for modular sets).
- `ScenarioRegistry` stops being filled by static imports; the pack loader registers scenarios when a pack loads.
- `DeclarativeScenarioPlugin` already makes `definition.json` sufficient for Rhino. Klaw/Ultron's code overrides
  (`resolveStage1ASetup`, `onVillainStageAdvanced`, Klaw II reveal) should be driven out into supplemental data wherever a
  generic primitive fits, as the plugins backlog already intends (Phase A). That makes most scenarios data-only and
  runtime-loadable.
- Modular sets (`modular-sets.json`) and `decks/` move into packs; the engine keeps only generic schemas.

### 3.4 Code in packs (the hard policy question)

| Tier | Content | Loading |
| --- | --- | --- |
| Declarative (JSON) | cards, supplemental, scenario definitions, decks, assets | Runtime, validated against generated schema. Safe for anyone. |
| Trusted code hooks | `scripts/*.ts` for unique mechanics (Wakanda Forever, Ultron drones…) | Build-time bundled for **official** packs only, or loaded from a signed/allow-listed location. |
| Untrusted code | user-supplied `plugin.ts` | **Not supported initially.** User packs are declarative only; if a mechanic needs code, add a generic primitive to the engine. Revisit with a sandbox ADR (Worker/iframe/WASM) later. |

Recommendation: ship declarative-only for user packs. It keeps the community story simple and avoids executing
downloaded code. The cost is that some official-only code hooks stay unavailable to creators until a sandbox exists.

### 3.5 Engine boots as an empty shell

- `cardCatalog`, supplemental registry, scenario registry, modular sets and starter decks become **runtime stores**
  populated by a `ContentLoader` over the pack list; zero packs is a valid state.
- Boot sequence: discover packs → validate manifests/schemas → resolve `dependsOn` → load → register. Failures disable a
  single pack with a visible reason, not the app.
- New **empty-state screen** (comic style): "Welcome to MCD — there's no content yet" with *Add content folder*, *Import
  pack (zip)*, *Sync official data*, and a link to the community docs. Scenario selector, deck builder and editor each get
  an empty state instead of assuming `'rhino'`.
- **Tests** keep using the tracked Core pack in tier 2. Fixture content is deferred to M12 (see section 0).
- **Leak guard**: a CI check that fails if the tracked tree contains forbidden paths/patterns (upstream JSON, pack
  supplemental, official art, rules PDFs), so the shell stays clean.

### 3.6 Platform reality (browser vs. Tauri)

A pure web build cannot read an arbitrary folder. Per ADR-0015 the loader sits behind a **storage driver** with two
implementations: Tauri/dev uses the real `content/` folder; the browser uses the File System Access API (pick a folder) or
IndexedDB (import a zip). The pack format is identical; only the driver differs. Today's editor writes via a Vite dev
middleware, so it must move onto the same driver before it can work in a shipped build.

### 3.7 Editors

I found one editor in the repo: the **Card Supplemental Editor** (`SupplementalEditorScreen` +
`api-middleware.ts`). There is no Scenario Editor yet. Plan: (a) make the existing editor pack-scoped (pick pack, official
packs read-only, user packs writable) and driver-based; (b) design the Scenario Editor as a new tool on the same
foundation, authoring `definition.json` and stage/ability references, after the pack format is stable. See Open Question 7.

### 3.8 Documentation reorganization

Split by audience, and ship the creator docs with the shell (the empty-state links to them):

```text
docs/
  creators/                  # community-facing, task oriented
    README.md                # start here: what is a pack, quick start with a minimal example pack
    pack-format.md           # pack.json, folder layout, codes/prefixes, dependsOn
    cards-and-heroes.md      # from hero_creation_guide.md
    scenarios.md             # from scenario_creation_guide.md (paths updated)
    supplemental-reference/  # the 11-file supplemental spec suite + QUICK_REFERENCE
    editor.md                # from tooling/card_supplemental_editor.md
    sharing-and-installing.md
  engine/                    # architecture, algorithmic rules reference, coding guidelines, plugin/loader API
  decisions/                 # ADRs unchanged (add new ADRs)
  backlog/  reports/  ambiguities/   # internal, unchanged
```

`tools/audit/docs-check.ts` already exists; extend it to check the new tree, relative links, and that every creator-facing
schema field is documented (the scenario guide's "Synchronous Documentation Mandate" already asks for this).

---

## 4. Phased roadmap (each milestone ≈ one thread / PR)

Order is chosen so the app keeps working at every step and the risky decisions come first.

| # | Milestone | Outcome | Notes / risk |
| --- | --- | --- | --- |
| **M0** | **Decisions + ADRs** | Answers to the open questions; new ADR "Content Packs & Runtime Loading" superseding ADR-0015's layout and plugins backlog Q3/Q4/Q5/Q9; decide repo/legal strategy. | Blocking. No code. |
| **M1** | **Copyright & coupling audit** | Inventory of every tracked file/line that embeds official content or hard-codes card codes (engine specials, UI, tests, locales, `references/`). Output: a checklist feeding the leak guard. | Read-only, cheap, de-risks M7. |
| **M2** | **Pack format + manifest schema + validator** | `pack.json` zod schema (generated JSON schema like supplemental), folder conventions, validator CLI (`npm run pack:validate`). | Pure additions. |
| **M3** | **Runtime `ContentLoader` + stores** | `cardCatalog`, supplemental registry, `ScenarioRegistry`, modular sets, starter decks fed by the loader; Node and dev-server drivers; app still loads Core from `content/packs/core`. | Largest engine/data change; golden-parity gate (seeded Rhino + 100-game simulation) must match. |
| **M4** | **Relocate official content into a Core pack** | Move `data/upstream` → pack `cards/`, supplemental, scenarios, decks, modular sets, Core `scripts/`. Update scripts (`simulate`, `card:*`, `cache:cards`), tsconfig/eslint/vitest, agent skills, AGENTS.md. | Mechanical but wide; one atomic change, no dual paths (AGENTS.md rule). |
| **M5** | **Scenario code → pack** | Scenarios loaded from packs; push Klaw/Ultron overrides into supplemental data or Core-pack scripts; `defineScenarioPlugin`/`@plugin-api` barrel per plugins backlog Phase A. | Resolves the `plugin.ts` policy (3.4). |
| **M6** | **Image cache per pack** | Move `cache/` → `content/.cache/images/<pack>`, pack-level image-name rules (kill the `01` special case), user pack art resolution order (user asset → cache → MarvelCDB), production asset serving. | Small; independent of M5. |
| **M7** | **Empty-shell boot + onboarding UI** | Zero-pack boot, welcome screen, folder/zip import, sync command in UI, per-screen empty states, pack list with errors. | The visible payoff; needs M3 + M2. |
| **M8** | **Tier 1 leak guard + reference untracking** | Untrack `references/` PDFs and rules Markdown copies (keep local lookup tooling), CI guard against committed art/PDFs. **Contributor setup:** a `references/SETUP.md` plus a `npm run setup:references` command that tells the contributor where to download the Rules Reference PDF (FFG's official support page, already in `references/links.md`), verifies the file name/checksum, and regenerates `references/rules/` locally with `tools/build_rules_markdown.py`; CONTRIBUTING.md, README and AGENTS.md (Rules Reference Inspection Policy) point to it, and `npm run rule` fails with a clear "run setup:references" message when the files are missing. | Small. Docs-check must tolerate the untracked paths. |
| **M9** | **Editor refactor** | Card Supplemental Editor pack-scoped on the storage driver (works in Tauri/browser, not just dev server). Scenario Editor postponed (Q7); scenario docs come from M10. | Separate track after M7. |
| **M10** | **Docs reorganization** | `docs/creators/` + `docs/engine/` split, link and doc-check updates, "make your first pack" tutorial using a small example pack. | Can start at M2 and finish after M9; link redirects handled in the same PR. |
| **M11** | **Browser/Tauri drivers & distribution** | File System Access / IndexedDB driver, Tauri folder driver, pack zip import/export, pack versioning and `apiVersion` checks. | Depends on the platform decision (Q5). |

| **M12** | **(Tier 3, deferred) Decouple the Core pack** | Untrack and ignore `content/packs/core`, add the sync command or content repo, optionally rewrite history. Plan fixtures and the test split here, not before. | Only if/when wanted; Q1 and Q2 apply here. |

Suggested first three threads: **M0** (decisions, with you), **M1** (audit), **M2** (pack format + schema).

---

## 5. Open questions for Steve

Recommendations are in bold.

1. **Where does the official supplemental/scenario content live once it leaves the shell?** It is MCD's own work but is
   derived from copyrighted card text. Options: a separate repo (public or private) that the sync tool pulls;
   a user-local only convention; or keep it in this repo and only drop upstream data/images. **Separate repo, with the
   shell repo holding none of it.** (Not legal advice; worth a quick check with someone who can give it.)
2. **Git history.** The upstream JSON and card text are already in history. Removing them means a history rewrite or a fresh
   repo. **Decide before M8; a fresh public repo with a clean initial commit is the only way to be fully clean.**
3. **Runtime vs build-time loading.** The shell needs runtime loading; the plugins backlog said build-time only.
   **Runtime for data, build-time for trusted code hooks (3.4).**
4. **Untrusted user code.** **No user `plugin.ts` initially, declarative only**; sandbox is a later ADR. Acceptable for
   your community goals?
5. **Targets.** Tauri desktop only for the shell, or browser as well? Browser needs the File System Access/IndexedDB
   driver and has weaker folder semantics. **Tauri + dev first, browser import-by-zip later.**
6. **Timing vs roadmap gates.** Gate 1 (Rhino) is active and Gate 2 is Klaw & Ultron. **Do M0–M2 in parallel (no behavior
   change), start M3 after Gate 1, and fold Klaw/Ultron work into M5.**
7. **"Scenario Editor".** Only the Card Supplemental Editor exists today. Do you mean a new tool, or the supplemental
   editor extended to scenarios? **New tool after the pack format is stable (M9).**
8. **Rules reference & campaign rulebooks in `references/`.** They look like third-party copyrighted material and are
   also agent tooling (`npm run rule`). Keep them local-only like content? **Gitignore them and keep the lookup tooling.**
9. **Folder name and shape.** `content/` vs `plugins/` vs `packs/`, and one folder per pack (proposed) vs ADR-0015's
   per-type folders. **`content/packs/<id>/`.**
10. **Pack card format.** Keep zzorba/marvelsdb JSON as the raw card format (interop with MarvelCDB tooling, minimal
    mapping) or define an MCD-native one. **Keep zzorba's format.**
11. **Test strategy.** Parked: fixtures are planned only if the Core pack is dropped (M12), per Steve (2026-10-31).
12. **Naming and branding in the shell.** Does the shell still call itself "Marvel Champions Digital", or something
    neutral, given the trademark? Affects README, window title, locale strings, and fonts/art direction text.

---

## 6. Risks

- **Deferred cost**: 260+ engine test files lean on real Core cards; this only bites at M12.
- **Static-import assumptions** are everywhere (`card-loader`, `supplemental/index.ts`, scenario `index.ts`, scripts); the
  loader change touches nearly every consumer of the catalog.
- **Determinism**: moving to async runtime loading must not change seeded outcomes; keep the golden-parity gate from the
  plugins backlog (§A0).
- **Agent tooling**: AGENTS.md, skills (`card-integration-protocol`, `single-card-supplemental`, `bug-fix`), the audit tools
  and docs-check all reference current paths and must change in the same PRs as the moves.
- **Contributor workflow**: after M8 contributors need the content repo to work on card behavior; the sync command and
  docs must make that a one-liner.
