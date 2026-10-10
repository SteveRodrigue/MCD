# Plan: Content Plugins — Scenarios, Card Hooks, and Campaigns

**Status:** Backlogged — revised after `/grill-me` review (2026-10-07). Awaiting ADR + Phase A scheduling.
**Roadmap alignment:** Gate 1 (Rhino Release) is active. Phase A is a **Gate 2 enabler** (Klaw & Ultron). Phase B follows Phase A. Phase C (campaigns) is **Gate 4+** and starts with research only.

---

## 0. Decision Log (from review)

| #   | Topic                 | Decision                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Scope                 | Split into **Phase A** (BaseScenarioPlugin + declarative stage reveals), **Phase B** (`plugins/` relocation + discovery), **Phase C** (campaigns, research-first).                                                                                                                                                                        |
| Q2  | Code extension point  | Engine primitives first, but mods and official content **need a code hook** for truly unique card abilities / scenario rules. Without one, creators would have to patch the engine or be limited to existing primitives. The existing `special-registry` + `EXECUTE_SPECIAL` becomes that hook (generalized, not duplicated).              |
| Q3  | Mod delivery          | **Build-time only.** Custom mods live in `plugins/custom/` and are compiled into the bundle (trusted, type-checked, gated). Runtime mod loading is out of scope (future ADR).                                                                                                                                                             |
| Q4  | Discovery & loading   | **Codegen**, not `import.meta.glob` (which does not exist under `tsx`; it would break `npm run simulate`, `card:extract`, etc.). Two tiers: an eager lightweight catalog for browsing, plus lazy `() => import()` loaders per pack. An async `loadContentForGame(selection)` runs before the engine's `createGame`, which stays synchronous. |
| Q5  | Location              | **Uniform:** official content moves to `plugins/official/<pack>/` (dogfoods the mod API). AGENTS.md, skills, scripts, editor and docs are updated in the same change. No dual paths.                                                                                                                                                      |
| Q6  | File granularity      | Supplemental files **mirror upstream 1:1** (`cards/core.json`, `cards/core_encounter.json`). Scripts always live at pack level in `cards/scripts/<cardCode>-<slug>.ts`. Scenario folders hold only `definition.json`, an optional `plugin.ts`, and `README.md`.                                                                          |
| Q7  | Identity & collisions | Codegen **hard-fails** on duplicate card codes, scenario ids or campaign ids. Custom mods may enrich **only their own** `raw.json` cards (no overriding official supplemental). Custom codes use a mod prefix (`<modId>-0001`), enforced by JSON schema.                                                                                     |
| Q8  | Correctness           | File a GitHub issue for the live Rhino bugs. Fix them in Phase A with failing tests written first. The base plugin reads HP and exclusions only from data, uses a seedable shuffle, and does not build ids from `Date.now()`.                                                                                                              |
| Q9  | Plugin API            | Single public barrel `src/engine/plugin-api/index.ts` (alias `@plugin-api`). ESLint forbids `plugins/**` from importing any other engine path. `manifest.json` declares `apiVersion`, which codegen checks.                                                                                                                               |
| Q10 | Override model        | **Composition:** `defineScenarioPlugin({ hooks })` with partial overrides. Each hook is `(state, ctx, next)`, and `next()` runs the default behavior.                                                                                                                                                                                      |
| Q11 | Safety net            | **Golden-parity gate:** seeded Rhino snapshots + a seeded 100-game simulation summary must match before/after, except the intentional Q8 fixes, which get dedicated tests.                                                                                                                                                                |
| Q12 | Governance            | One new ADR, **"Content Plugin Architecture"** (amends ADR-0033), written before Phase A. Campaigns get their own ADR when Phase C is scheduled.                                                                                                                                                                                         |
| Q13 | Campaigns             | Phase C starts with a **campaign-rulebook survey**: convert the campaign rulebooks and logs in `references/` into structured Markdown under `references/campaigns/`. Interfaces are derived from that survey. The earlier draft interfaces are withdrawn.                                                                                  |
| Q14 | Editor scope          | Phase B: the editor reads and writes supplemental data for official **and** custom packs. Authoring custom `raw.json` cards and uploading art are a separate future backlog item.                                                                                                                                                         |

---

## 1. Architectural Principles

1. **Pristine upstream (`data/upstream/`)**: the canonical zzorba dataset. It is never modified and never receives MCD files.
2. **Overlay plugins (`plugins/`)**: pack-as-a-package overlays. Official and custom content use the **same** structure, loader and API.
3. **Declarative first, code hook second**: card behavior is expressed in supplemental JSON using generic primitives. A code hook (`registerSpecialHandler`, scenario `plugin.ts`) is allowed only for genuinely unique mechanics, and its README/PR must say why no primitive fits.
4. **Headless engine stays synchronous and pure**: content loading (async, lazy) happens _outside_ the engine. The engine receives an already-loaded content bundle.
5. **Stable mod contract**: plugins only see `@plugin-api`. Engine internals can change freely behind it.
6. **One source of truth per fact**: stage HP, stage order, exclusions and set codes live in `definition.json` / the catalog. They are never repeated in code.

---

## 2. Target Directory Structure (Phase B end-state)

```text
data/upstream/                         # PRISTINE zzorba dataset (unchanged)
plugins/
  official/
    core/
      manifest.json                    # { id, name, type, apiVersion }
      cards/
        core.json                      # Supplemental, mirrors data/upstream/pack/core.json
        core_encounter.json            # Supplemental, mirrors upstream core_encounter.json
        scripts/
          01043-wakanda-forever.ts     # registerSpecialHandler via @plugin-api
          01140-ultron-drones.ts
      scenarios/
        rhino/  definition.json, README.md            # no plugin.ts
        klaw/   definition.json, plugin.ts?, README.md
        ultron/ definition.json, plugin.ts?, README.md
    <other official packs mirror the same layout>
  custom/
    <modId>/
      manifest.json                    # { id, name, type: "custom", apiVersion, author, version }
      cards/
        raw.json                       # REQUIRED if mod adds cards; RawUpstreamCard[]; codes "<modId>-NNNN"
        <modId>.json                   # Supplemental for the mod's own cards only
        scripts/
      assets/cards/<code>.png|jpg
      scenarios/<scenarioId>/definition.json, plugin.ts?
src/
  engine/plugin-api/index.ts           # The ONLY engine import surface for plugins/**
  generated/plugin-index.ts            # Codegen output (gitignored)
```

---

## 3. Rules Reference v1.8 Verification

Sources: `references/rules/glossary/V.md#villain-defeat`, Main Scheme, Appendix (Setup). Cross-check the Timing & Triggers and Combat clusters in `TOPIC_MAP.md`.

1. **Villain Defeat**
   - When HP reaches 0, remove the stage. Reveal the next sequential stage for the current difficulty (this cannot be canceled). Set HP to `healthPerPlayer[stage] × P`. Excess damage does not carry over.
   - **Same title:** treated as the same character (e.g. Retaliate). Attachments, upgrades, status cards, counters and non-damage tokens **carry over**. If the villain was defeated while activating, the **activation resumes** with the new stage.
   - **Different title:** none of the above carries over. An in-progress activation **ends without resolving**.
   - The reveal fires the new stage's `WHEN_REVEALED` supplemental ability through the standard effect pipeline.
   - If the final stage is defeated, the heroes win.
2. **Main Scheme**: when threat reaches the target, advance to the next stage. Its `WHEN_REVEALED`/setup fires and target threat is rescaled. If the final stage completes, the villain wins.
3. **Setup (Steps 1–15)**: the base plugin plugs into the existing `game-setup.ts` pipeline (ADR-0033). It does not duplicate it. The encounter deck is built from the scenario set + Standard (+ Expert) + modular sets − definition-declared exclusions, and is shuffled with the injected `shuffleFn`.

**Known live deviations (Q8, go to the GitHub issue):**

- `RhinoScenarioPlugin.advanceToStage` clears `statusCards`/`attachments` on I→II although the titles match.
- Stage HP is hardcoded (`numPlayers * 15`, `* 16`) instead of read from `definition.json`.
- Shuffles use a `Math.random` sort (biased, not seedable) and ignore the `shuffleFn` that `game-setup.ts` already supports.
- The Rhino II/III `WHEN_REVEALED` effects are re-implemented imperatively even though `core_encounter.json` (01095/01096) already declares them.

---

## 4. Phase A — BaseScenarioPlugin & Declarative Stage Reveals (Gate 2 enabler)

### A0. Prerequisites

- Write the ADR **"Content Plugin Architecture"** (next free number, amends ADR-0033), recording decisions Q2–Q12.
- File the GitHub issue for the Rhino deviations listed in §3.
- **Seedable RNG:** all engine randomness goes through one injectable RNG/`shuffleFn`. This is required for the golden-parity gate; today about 18 `Math.random` call sites exist in `effects/`, the pipeline and `deck-utils`. Ids come from a deterministic counter or the RNG, not `Date.now()`.
- Capture **golden baselines** with the current code: seeded Rhino setup and stage-transition snapshots (Standard, Expert, Skirmish; 1–4 players), plus a seeded 100-game simulation summary.

### A1. `@plugin-api` barrel

`src/engine/plugin-api/index.ts` exports:

- Hook types: `ScenarioHooks`, `ScenarioHookContext`, `defineScenarioPlugin`, `ScenarioDefinition`.
- `registerSpecialHandler` / `SpecialAbilityHandler` (the existing registry, now public). Handlers may be keyed by `cardCode` and/or ability id.
- Read-only catalog access, `executeEffect`, the RNG/shuffle, card-instance creation, and log helpers.
- `PLUGIN_API_VERSION`.
- ESLint `no-restricted-imports` on `plugins/**/*.ts`: only `@plugin-api` is allowed from the engine.

### A2. Base scenario behavior + composition

`src/engine/scenarios/base-scenario-plugin.ts` holds the default implementations. `defineScenarioPlugin(definition, hooks?)` composes them:

```ts
type Hook<A extends unknown[], R> = (state: GameState, ctx: ScenarioHookContext, next: () => R, ...args: A) => R;
```

- `onGameSetup`: active villain stage, main scheme stage (from definition), encounter deck (scenario set + standard/expert + modular − `encounterDeckExclusions`), shuffle via `ctx.shuffle`. Then reveal the starting villain stage and main scheme, which fires their `WHEN_REVEALED`/`SETUP` supplemental abilities. This means Expert Rhino II's _Breakin' & Takin'_ search runs via data, not code.
- `onVillainDefeated`: the full §3.1 behavior (title-match carryover, activation resume/end).
- `onMainSchemeCompleted`: stage advance or villain victory.
- `evaluateWinLossConditions`: standard checks.
- Villain-phase hooks default to the existing pipeline.

### A3. `ScenarioDefinition` additions (removing hardcoded values)

- `encounterSetCode` (replaces the hardcoded `'rhino'`).
- `mainSchemeSetup.stages` as card codes/stage ids used for lookups (replaces the hardcoded `'1B'`).
- `encounterDeckExclusions?: string[]` (replaces the hardcoded `01094…01097b`), with villain and main-scheme types excluded by default.
- `flavor?: { setupKey?, victoryKey?, defeatKey? }`: i18n keys for onomatopoeia instead of string literals.
- A JSON schema for `definition.json`, validated by codegen (Phase B) and by tests (Phase A).

### A4. Migrations

- **Rhino:** no `plugin.ts`. Delete `RhinoScenarioPlugin`. Verify that the 01095/01096 supplemental data fully covers the stage reveal effects and fill any primitive gaps generically.
- **Klaw / Ultron:** move card-specific logic into supplemental data, or into `registerSpecialHandler` scripts when no primitive fits. Any remaining scenario-rule logic becomes thin `defineScenarioPlugin` hook overrides that call `next()`.
- Phase A keeps the current file locations (`src/engine/scenarios/built-in/`). Relocation is Phase B.

### A5. Phase A tests

- Golden-parity tests (A0 baselines): exact match, except the Q8 deltas.
- Q8 regression tests, written first and failing before the fix:
  - same-title carryover of status, attachments and counters;
  - different-title clearing;
  - activation resume vs end;
  - HP read from the definition.
- Composition tests: an override that calls `next()` wraps the default; an override that does not call `next()` replaces it.
- `definition.json` schema validation for all scenarios.

---

## 5. Phase B — `plugins/` Relocation, Codegen Discovery, Tooling

### B1. Codegen: `npm run plugins:generate`

- Runs in the `predev`/`prebuild`/`pretest`/`presimulate` hooks, alongside `schema:generate`.
- Scans `plugins/{official,custom}/*/manifest.json` and writes `src/generated/plugin-index.ts` (gitignored):
  - **Tier 1, eager catalog:** pack manifests, scenario headers (id, name, villain, difficulties, recommended modulars), and hero entries for selection screens.
  - **Tier 2, lazy loaders:** `{ [packId]: () => import(...) }` for raw cards, supplemental and scripts; `{ [scenarioId]: () => import(plugin.ts) }`.
- **Validation (hard fail):**
  - duplicate card codes, scenario ids or campaign ids;
  - a custom supplemental entry targeting a code not in that mod's `raw.json`;
  - a custom code missing the `<modId>-` prefix;
  - an `apiVersion` mismatch;
  - a JSON schema violation.

### B2. Async content loading outside the engine

- `loadContentForGame({ scenarioId, modularSetCodes, heroIds })`, in `src/data/`, not the engine:
  - resolves the packs needed;
  - awaits the lazy loaders;
  - registers the cards, supplemental data and special handlers;
  - returns a content bundle.
- Then the synchronous `createGame` runs. The UI shows a comic-style loading splash between pressing **Start Game** and the board.
- Node scripts (`simulate`, `card:extract`, `cache:cards`) use the same loader, since dynamic `import()` works under `tsx`.

### B3. Relocation (single change, no dual paths)

- `src/data/supplemental/pack/*.json` → `plugins/official/<pack>/cards/<same-name>.json`, mirroring upstream.
- `src/engine/specials/wakanda-forever.ts` → `plugins/official/core/cards/scripts/01043-wakanda-forever.ts`.
- `src/engine/scenarios/built-in/*` → `plugins/official/core/scenarios/*`.
- Replace the static imports in `card-loader.ts`, `supplemental/index.ts`, `scripts/simulate-games.ts` and `scripts/cache-card-images.ts` with the loader.
- Update `tsconfig.json` (`include`, `@plugin-api`), the ESLint config and the Vitest config.
- **Docs and agent tooling in the same change:**
  - AGENTS.md: the principle "card-specific behavior declarative in `src/data/supplemental/`" becomes `plugins/<scope>/<pack>/cards/`.
  - Skills: `card-integration-protocol`, `single-card-supplemental`, `bug-fix` and any skill that references the old paths.
  - Scripts: `scripts/extract-card.ts`, `scripts/validate-card.ts`, `tools/audit/*`, `tools/generate-supplemental-schema.ts`.
  - README/ADR cross-links.

### B4. Card Supplemental Editor (UI impact)

- `src/tools/editor/api-middleware.ts`: the pack list spans `plugins/official/*` and `plugins/custom/*`. Reads come from `data/upstream/` (official) or `cards/raw.json` (custom). Writes go to the matching `plugins/<scope>/<pack>/cards/<file>.json`.
- Pack picker UI: group by Official / Custom and keep the pop-art styling. Custom raw-card authoring and art upload are **out of scope** (separate backlog item, Q14).

### B5. Assets

- Dev middleware `/cards/:fileName` lookup order:
  1. `plugins/custom/*/assets/cards/` (no collisions possible thanks to the Q7 prefixes);
  2. `cache/cards/`;
  3. on-demand MarvelCDB download.
- Production: a Vite plugin copies `plugins/custom/*/assets/cards/*` into `dist/cards/`.

### B6. Phase B tests

- Codegen: a fixture mod for each hard-fail rule; a happy path producing a deterministic index.
- `loadContentForGame` loads only the selected packs (assert untouched loaders).
- `custom-scenario.test.ts`: a fixture mod in `tests/fixtures/plugins/custom/` (not in the real `plugins/custom/`) with raw cards, supplemental, a scenario and a script hook, played through setup and one stage transition.
- Lint test: a fixture plugin importing `@engine/effects` fails ESLint.
- Editor API: `/api/supplemental/packs`, `/card/:code` GET/POST round-trip for an official and a custom pack.
- Assets: custom art resolves before the cache.
- `npm run simulate` still passes the 100-game gate.

---

## 6. Phase C — Campaigns (Gate 4+, research-first)

### C1. Campaign-rulebook survey (first deliverable, no code)

- Convert the campaign rulebooks and campaign logs in `references/` into structured Markdown under `references/campaigns/<box>/`, following the `references/rules/` conventions (setup, between-scenario steps, log fields, defeat/retry rules, expert campaign differences):
  - `mc10` The Rise of Red Skull
  - `mc16` Galaxy's Most Wanted
  - `mc21` The Mad Titan's Shadow
  - `mc27` Sinister Motives
  - `mc32` Mutant Genesis
  - `mc40` NeXt Evolution
  - `mc45` Age of Apocalypse
  - `mc50` Agents of S.H.I.E.L.D.
- Add a lookup path (extend `scripts/lookup-rule.ts` or add a sibling) and update the Rules Reference Inspection Policy in AGENTS.md to cover campaign references.
- Produce a **pattern matrix**: which mechanics are common to all campaigns (ordered scenarios, log flags/counters, card awards, persistent hit points) and which are campaign-specific (e.g. the GMW ship/market, AoA's structure, MTS specifics).

### C2. Requirements (constraints already fixed)

- Rides the same plugin model: `plugins/<scope>/<pack>/campaigns/<id>/definition.json` + an optional `plugin.ts`, discovered by codegen, with access only through `@plugin-api`.
- Campaign state lives **outside** the headless game engine as a meta-layer. Each scenario is a normal `createGame` with campaign-derived setup inputs, and its result feeds back into the campaign state.
- Typed state only: no `Record<string, any>`. The log schema is derived from C1.

### C3. Open questions (resolved by C1 + campaign ADR)

- Persistence and save format: local storage, export/import file, versioning.
- Deck modification model between scenarios: awards, obligations, upgrades, plus Card Editor/UI impact.
- Defeat handling per campaign (retry vs. continue with penalties) and expert campaign variants.
- How much of each campaign-specific mechanic should be declarative vs. a `plugin.ts` hook.

---

## 7. Quality Gates (every phase)

- `rtk npm test`, `rtk npm run lint`, `npm run simulate` (100-game gate), `npm run plugins:generate` (Phase B+).
- No skipped/todo tests, no legacy aliases or duplicate paths left behind (AGENTS.md).
- Each phase gets its own implementation plan derived from this backlog doc, and waits for user approval before any code is written.
