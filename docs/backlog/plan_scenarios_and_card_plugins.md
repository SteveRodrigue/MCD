# Plan: Scenarios, Card Plugins, and Campaign Architecture

**Status:** Prepared / Backlogged (Awaiting Execution)

---

## 1. Overview & Architectural Vision

This plan establishes a unified **Content Plugin & Clean Overlay Architecture** for Marvel Champions Digital (MCD), organizing the game into three first-class plugin types:
1. **Card Plugins & Scripts:** Declarative rules enrichment and scriptable behaviors attached directly to cards.
2. **Scenario Plugins:** Declarative scenario definitions with a universal `BaseScenarioPlugin` lifecycle runner.
3. **Campaign Plugins:** Sequenced meta-controllers chaining 2+ scenarios together with persistent campaign log state, between-game deck upgrades, and branching rewards.

### Core Architectural Principles

1. **Pristine Upstream Layer (`data/upstream/`):**
   - Remains 100% untouched and canonical (external zzorba/marvelsdb-json-data clone/submodule).
   - Serves as the immutable source of raw cards, sets, packs, and factions.
   - Upstream repository structure is never modified or polluted with MCD engine files.

2. **Clean Overlay Layer (`plugins/`):**
   - Pack-as-a-Package overlays that augment upstream data without duplicating or altering zzorba structures.
   - `plugins/official/<pack>/`: Houses MCD rules enrichment (`cards/supplemental.json`), complex card scripts (`cards/scripts/`), scenario manifests (`scenarios/<id>/definition.json`), and campaign manifests (`campaigns/<id>/definition.json`). Official artwork continues to be served via the standard cache/MarvelCDB pipeline.
   - `plugins/custom/<mod>/`: Community or custom packs that define:
     - `cards/raw.json`: **Mandatory**. Strictly adheres to the upstream zzorba card schema (`RawUpstreamCard` / `data/upstream/schema/card_schema.json`). Base card stats (cost, traits, stats) are never conflated with supplemental rules.
     - `cards/supplemental.json`: **Mandatory**. MCD rules enrichment (abilities, triggers, effects).
     - `assets/cards/`: **Card Image Storage**. Houses custom card artwork (e.g. `<cardCode>.png` or `<cardCode>.jpg`).
     - `scenarios/<id>/`: Custom scenario definitions and optional plugins.
     - `campaigns/<id>/`: Custom campaign definitions chaining custom or official scenarios.

3. **Universal `BaseScenarioPlugin`:**
   - Encapsulates ~80% of boilerplate currently duplicated across Rhino, Klaw, and Ultron plugins.
   - Strictly implements canonical Marvel Champions Rules Reference v1.8 scenario lifecycle:
     - Steps 1–15 game setup (Villain HP scaling $HP \times P$, Main Scheme target threat $Target \times P$, encounter deck construction & shuffling).
     - Villain defeat & sequential stage transitions (I $\to$ II $\to$ III), attachment/status card carryover according to title match, and revealing the new stage.
     - Main scheme completion & stage progression (1B $\to$ 2A/2B) or villain victory.
     - Evaluates standard win/loss conditions.
   - Standard scenarios (e.g. Rhino) require **only `definition.json`**; custom `plugin.ts` files are purely optional and only created when overriding game phases (e.g. custom villain rotation or special win/loss rules).

4. **Unified `CardScriptRegistry` & Card Plugins:**
   - Stage Setup (1A) and stage transition triggers (e.g. Rhino II, Klaw II, Ultron Drones) belong on the cards themselves, not inside scenario plugins.
   - Standard abilities live declaratively in `cards/supplemental.json`.
   - Complex/scripted card behaviors (e.g. Wakanda Forever sequence ordering, Ultron drone generation, Klaw minion discarding) register in a unified `CardScriptRegistry` keyed by `cardCode` (and ability ID).

5. **Campaign Plugins (Chaining Scenarios):**
   - Chains 2 or more scenarios sequentially (e.g. *The Rise of Red Skull*, *The Mad Titan's Shadow*, *Sinister Motives*).
   - Manages persistent campaign state (`CampaignState`):
     - Campaign Log (recorded achievements, victory milestones, defeat penalties, delay counters).
     - Hero deck adjustments between scenarios (awarded campaign pool cards, upgrades, obligations).
     - Persistent damage or threat carryover where specified by campaign rules.
   - Declarative manifest (`campaigns/<id>/definition.json`) defines scenario order, setup steps, and transition rules.
   - Optional `plugin.ts` implements custom intermission mechanics (e.g. market deck drafting in *Galaxy's Most Wanted* or gauntlet rules in *The Mad Titan's Shadow*).

6. **Auto-Discovery via `import.meta.glob`:**
   - Scenarios, cards, scripts, and campaigns are automatically discovered and registered at build/test time via Vite `import.meta.glob`, eliminating manual registration boilerplate in central index files.

7. **Tooling Alignment:**
   - Card Supplemental Editor middleware (`src/tools/editor/api-middleware.ts`) is updated to read raw cards from `data/upstream/` and persist supplemental overlays into `plugins/official/<pack>/cards/` or `plugins/custom/<mod>/cards/`.

---

## 2. Target Directory Structure

```text
data/
  upstream/                      # PRISTINE: Canonical zzorba dataset (untouched)
    packs.json
    sets.json
    pack/
      core.json
      core_encounter.json
      ...
plugins/
  official/
    core/
      manifest.json              # { "id": "core", "name": "Core Set", "type": "core" }
      cards/
        supplemental.json        # Rules enrichment for core cards & encounters
        scripts/
          wakanda-forever.ts     # Script for card 01043 / WAKANDA_FOREVER
      scenarios/
        rhino/
          definition.json        # Manifest (villain stages, threat, modular sets)
          README.md
        klaw/
          definition.json
          cards/scripts/         # Scripts for Defense Network (01125), Immortal Klaw (01127)
          README.md
        ultron/
          definition.json
          cards/scripts/
            ultron-drones.ts     # Script for Ultron's Drones environment (01140)
          README.md
    the_rise_of_red_skull/
      manifest.json
      cards/
        supplemental.json
      scenarios/
        crossbones/
          definition.json
        absorbing_man/
          definition.json
        taskmaster/
          definition.json
        zola/
          definition.json
        red_skull/
          definition.json
      campaigns/
        the_rise_of_red_skull/
          definition.json        # Chained: crossbones -> absorbing_man -> taskmaster -> zola -> red_skull
          plugin.ts              # Optional: Intermission rules, tech upgrade deck, delay tokens
  custom/
    <community-mod>/
      manifest.json
      assets/
        cards/                   # MANDATORY for cards with art: <cardCode>.png / .jpg
      cards/
        raw.json                 # MANDATORY: Upstream zzorba schema (RawUpstreamCard[])
        supplemental.json        # MANDATORY: MCD rules enrichment (CardEnrichment)
        scripts/                 # Optional: Custom TS card scripts
      scenarios/
        <scenario-id>/
          definition.json
          plugin.ts              # Optional: Custom scenario lifecycle hooks
      campaigns/
        <campaign-id>/
          definition.json        # Chained scenario IDs + progression rules
          plugin.ts              # Optional: Custom campaign rules
```

---

## 3. Rules Reference v1.8 Verification

1. **Villain Defeat (RR v1.8 / Glossary: Villain Defeat):**
   - When villain stage hit points reach 0: remove stage from the game.
   - If next sequential stage exists in scenario stages:
     - Set HP dial to $HP \times P$ per stage definition.
     - Reveal new stage (cannot be canceled).
     - **Title match rule:** If new stage has the same title as defeated stage, status cards, counters, and attachments carry over. If title differs, attachments and status cards do not carry over.
     - Excess damage dealt to defeat previous stage does not carry over.
     - Revealing the new stage invokes its `WHEN_REVEALED` effect via standard engine ability execution.
   - If final stage defeated: HEROES win the game.

2. **Main Scheme Completion (RR v1.8 / Glossary: Main Scheme):**
   - When threat reaches target threat: advance to next sequential stage (e.g. 1B $\to$ 2A/2B).
   - If final stage completed: VILLAIN wins the game.

3. **Step 1–15 Scenario Setup (RR v1.8 / Appendix II: Setup):**
   - Villain Stage 1 placed with starting HP dial ($HP \times P$).
   - Main Scheme 1A revealed $\to$ executes its `SETUP` ability (placing environments, side schemes, or starting minions).
   - Encounter deck assembled: Scenario encounter set + Standard set + (Expert set if Expert) + Selected Modular sets - Exclusions (Villains, Main Schemes) $\to$ shuffled into `state.encounterDeck`.

4. **Campaign Progression Rules (Official Campaign Rulebooks):**
   - Scenarios are played in strict sequential order.
   - Upon scenario victory: players record health/threat/counters into Campaign Log, earn upgrades/assets, and proceed to the next scenario.
   - Upon scenario defeat: depending on difficulty mode (Standard Campaign vs Expert Campaign), players restart the current scenario or suffer campaign loss.

---

## 4. Component Architecture & Interfaces

### 4.1. Universal `BaseScenarioPlugin`
**File:** `src/engine/scenarios/base-scenario-plugin.ts`
- Implements `ScenarioPlugin` interface.
- Constructor accepts `definition: ScenarioDefinition`.
- Default implementations:
  - `onGameSetup(state, options)`: Validates difficulty, sets up active villain, sets up active main scheme, builds encounter deck using catalog set expansions, shuffles deck, and triggers Stage 1A setup.
  - `onVillainDefeated(state, defeatedVillainInstanceId)`: Detects next stage for current difficulty, replaces villain card, carries over status/attachments if titles match, resets HP, and reveals new stage card (firing its `WHEN_REVEALED` ability). If final stage, marks `state.winner = 'HEROES'`.
  - `onMainSchemeCompleted(state, completedSchemeInstanceId)`: Advances main scheme stage or marks `state.winner = 'VILLAIN'`.
  - `evaluateWinLossConditions(state)`: Standard evaluation (all heroes defeated $\to$ villain wins).
  - Optional hooks (`onVillainPhaseStep1`, `onVillainPhaseStep2`) default to standard engine pipeline behavior.

### 4.2. Unified `CardScriptRegistry` & Card Plugins
**File:** `src/engine/cards/card-script-registry.ts`
- Unifies `src/engine/specials/special-registry.ts` with scenario and encounter card scripts.
- Interface:
  ```typescript
  export interface CardScript {
    cardCode?: string;
    abilityId?: string;
    validatePlayCondition?: (state: GameState, context: EffectExecutionContext) => boolean;
    execute: (state: GameState, context: EffectExecutionContext, payload?: any) => EffectResult;
  }
  ```
- Functions: `registerCardScript(script: CardScript)`, `getCardScript(codeOrId: string)`.
- Replaces hardcoded scenario plugin methods for:
  - Wakanda Forever (`01043`)
  - Rhino II When Revealed (`01095` $\to$ Search & reveal *Breakin' & Takin'*)
  - Klaw 1A Setup (`01124a` $\to$ Search & reveal *Defense Network*, discard until minion found)
  - Ultron 1A Setup / Drones (`01136a` / `01140` $\to$ Spawn drone minion instances from player decks)

### 4.3. Campaign Plugin System
**File:** `src/engine/campaigns/types.ts` & `src/engine/campaigns/base-campaign-plugin.ts`
- **Manifest Schema (`definition.json`):**
  ```typescript
  export interface CampaignDefinition {
    id: string;
    name: string;
    author?: string;
    version?: string;
    scenarios: Array<{
      scenarioId: string;
      title: string;
      recommendedModularSets?: string[];
      setupOverrides?: Record<string, any>;
    }>;
    campaignLogSchema: {
      numericTrackers?: string[];
      booleanFlags?: string[];
      awardedCards?: string[];
    };
  }
  ```
- **Campaign State & Lifecycle:**
  ```typescript
  export interface CampaignState {
    campaignId: string;
    currentScenarioIndex: number;
    difficulty: DifficultyMode;
    campaignLog: Record<string, any>;
    playerDecks: Record<string, string[]>;
    history: Array<{
      scenarioId: string;
      victory: boolean;
      rounds: number;
      recordedState: Record<string, any>;
    }>;
  }

  export interface CampaignPlugin {
    definition: CampaignDefinition;
    onCampaignStart(state: CampaignState): CampaignState;
    onScenarioCompleted(
      state: CampaignState,
      scenarioResult: { scenarioId: string; victory: boolean; gameState: GameState },
    ): {
      state: CampaignState;
      nextScenarioId?: string;
      campaignVictory?: boolean;
      campaignDefeat?: boolean;
    };
  }
  ```

### 4.4. Auto-Discovery & Loaders
**Files:** `src/engine/scenarios/loader.ts`, `src/engine/campaigns/loader.ts`, `src/data/supplemental/index.ts`
- Uses Vite's `import.meta.glob`:
  - `import.meta.glob('/plugins/**/scenarios/**/definition.json', { eager: true })`
  - `import.meta.glob('/plugins/**/scenarios/**/plugin.ts', { eager: true })`
  - `import.meta.glob('/plugins/**/campaigns/**/definition.json', { eager: true })`
  - `import.meta.glob('/plugins/**/campaigns/**/plugin.ts', { eager: true })`
  - `import.meta.glob('/plugins/**/cards/supplemental.json', { eager: true })`
  - `import.meta.glob('/plugins/**/cards/scripts/*.ts', { eager: true })`
  - `import.meta.glob('/plugins/custom/**/cards/raw.json', { eager: true })`
- Automatically registers and aliases cards, scenarios, and campaigns.

### 4.5. Asset Pipeline & Custom Card Images
**File:** `vite.config.ts` & Asset Serving Middleware
- In development mode, the card image middleware intercepts `/cards/:fileName` requests.
- **Lookup Order:**
  1. Check `plugins/custom/**/assets/cards/${fileName}` on local disk (serving custom community card art).
  2. Check official local disk cache (`cache/cards/${fileName}`).
  3. If missing from cache, download official asset on-demand from MarvelCDB / remote URLs.
- In production builds (`npm run build`), static assets from `plugins/custom/**/assets/cards/` are packaged directly into `dist/cards/` alongside cached official assets.

### 4.6. Card Supplemental Editor Middleware
**File:** `src/tools/editor/api-middleware.ts`
- Update `CardSupplementalService`:
  - `upstreamDir`: `data/upstream/` (canonical raw cards).
  - `supplementalPackDir`: points to `plugins/official/<pack>/cards/` (or `plugins/custom/<mod>/cards/`).
  - Automatically loads and saves `supplemental.json` in the respective plugin package.

---

## 5. Migration Execution Steps

1. **Step 1: Engine Foundation**
   - Create `src/engine/scenarios/base-scenario-plugin.ts`.
   - Create `src/engine/cards/card-script-registry.ts`.
   - Create `src/engine/campaigns/` (types, `base-campaign-plugin.ts`, loader, registry).
   - Update `src/engine/pipeline/scenario-helpers.ts` to trigger card reveals during stage advancement.

2. **Step 2: Root `plugins/` Setup & Auto-Discovery**
   - Create root `plugins/official/core/` directory structure.
   - Migrate `src/data/supplemental/pack/core.json` and `core_encounter.json` to `plugins/official/core/cards/supplemental.json`.
   - Move `wakanda-forever.ts` to `plugins/official/core/cards/scripts/wakanda-forever.ts`.
   - Implement Vite `import.meta.glob` auto-discovery in `src/data/supplemental/index.ts`, `src/engine/scenarios/loader.ts`, and `src/engine/campaigns/loader.ts`.

3. **Step 3: Scenario Refactoring**
   - Move Rhino, Klaw, Ultron definitions to `plugins/official/core/scenarios/`.
   - Migrate Rhino to pure `definition.json` (delete 379 lines of duplicate code in `RhinoScenarioPlugin`!).
   - Extract Klaw & Ultron card scripts to `plugins/official/core/cards/scripts/`.
   - Streamline or eliminate custom `plugin.ts` files for Klaw and Ultron.

4. **Step 4: Tooling & Editor Updates**
   - Update `src/tools/editor/api-middleware.ts` paths.
   - Update `vite.config.ts` asset serving middleware for `plugins/custom/**/assets/cards/`.
   - Update `tsconfig.json` `include` and `paths` (`@plugins/*`).

5. **Step 5: Verification & Cleanup**
   - Run full quality gates: `rtk npm test`, `rtk vitest run`, `rtk npm run lint`.
   - Remove obsolete files in `src/engine/scenarios/built-in/` and old supplemental pack paths.

---

## 6. Testing & Quality Gates

1. **Unit & Engine Tests:**
   - `tests/engine/scenario-plugin.test.ts`: Verify `BaseScenarioPlugin` correctly loads and runs Rhino.
   - `tests/engine/scenario-plugins-klaw-ultron.test.ts`: Verify Klaw and Ultron multi-stage transitions and drone spawning.
   - `tests/engine/scenario-setup-15-steps.test.ts`: Verify encounter deck construction across Standard, Expert, and Skirmish.
   - `tests/engine/custom-scenario.test.ts`: Verify custom community scenario loading from `plugins/custom/`.
   - `tests/engine/campaign-plugin.test.ts` (New): Verify multi-scenario chaining, state persistence, and log tracking.
2. **Editor API Tests:**
   - Verify `/api/packs`, `/api/cards/:code`, and `/api/supplemental/:code` read and write accurately to `plugins/`.
3. **Asset Serving Tests:**
   - Verify custom cards resolve artwork from `plugins/custom/**/assets/cards/` before falling back to official cache.
4. **Data Integrity:**
   - Validate JSON schemas across all `plugins/**/supplemental.json`, `plugins/**/definition.json`, and `plugins/custom/**/raw.json`.
