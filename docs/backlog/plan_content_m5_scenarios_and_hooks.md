# Plan — M5: Scenarios and hooks come from packs

**Status:** M5a implemented (PR #538) and M5b implemented (PR #540). M5c and M5d are approved and ready to implement; section 14 is their checklist and section 13 records where M5a and M5b differ from this plan. The handover for the next session is [`handover_content_refactor.md`](handover_content_refactor.md).
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (Q4, Q16, Q17, Q33, Q49; section 3.3 and 3.4) and [ADR-0092](../decisions/0092-content-packs-and-runtime-loading.md).
**Depends on:** M2 (schemas, `PackHooks`), M4 (content layout), M3 (runtime loader) and M5a (hook map), all merged.
**Gate note:** Gate 1 (Rhino) is still active. M5 touches the Rhino setup path, so every PR below is gated by byte-identical `simulate` output and by seeded setup digests for all three scenarios.

## 1. Goal

After M5 no scenario or card-specific code lives in the engine. A scenario is a `definition.json` in its pack and is registered when the pack loads. **Uniqueness decides where code lives (Q49):**

- What the existing effect primitives can express is **data**. Klaw's setup is printed text on its main scheme cards and every effect in it already exists, so Klaw is data.
- **Environments are an engine concept, not scenario code.** An environment card enters play in the villain's play area, like any other card put into play; the engine must do that for every environment card (91 cards in 16 packs), and a setup line like "put the Ultron Drones environment into play" is data.
- What only one scenario or card needs, and cannot be expressed generically, is a **script** in its pack, found through the generated hook map: Wakanda Forever (done in M5a) and, until the engine has a facedown-minion concept (decided, section 11), the one Ultron step that turns each player's top card into a facedown Drone. Ultron is the worked example of a scenario script.
- The engine keeps only generic behavior, and nothing in `src/engine` names a Core card code or defaults to `'rhino'`.

## 2. Facts (verified 2026-11-01 on `main`)

- `src/engine/scenarios/built-in/{rhino,klaw,ultron}/plugin.ts` are the only scenario code: Rhino is a bare `DeclarativeScenarioPlugin`; Klaw and Ultron subclass it for stage 1A setup only. They are registered by side effect in `scenarios/index.ts`; `definition.json` is already loaded from `content/packs/core/scenarios/<id>/`.
- `DeclarativeScenarioPlugin.onGameSetup` sets the main scheme directly to stage 1B and never resolves a main scheme's Setup or When Revealed; `onMainSchemeCompleted` swaps the card and logs, also without resolving anything. Only a villain's When Revealed runs from data (`revealVillainStage` through `kernel.executeEffect`).
- Klaw's printed setup is `SEARCH` (Defense Network, reveal, shuffle) and `DISCARD ... UNTIL_MATCH` (minion, into play, first player); both already exist as data (Klaw II `01114` and The Masters of Evil `01128`). **62 main scheme A sides in 17 packs have a `Setup:` line**; 15 cards use "discard until a minion". See the [Klaw review](klaw_setup_as_data_review.md).
- **Environment support is missing in the engine.** The zone exists (`state.environments` is read by legal actions, icons, the state validator and the card inspector), but **the only code that puts an environment into play is one line in Ultron's plugin**. A revealed environment card takes the treachery branch of the reveal code (`villain-phase.ts`): its When Revealed resolves and the card goes to the discard pile, which contradicts the Rules Reference (an environment enters play in the villain's play area). What later removes, replaces or discards an environment is up to each card or scenario effect, as for every other card type. 91 upstream cards are environments (16 packs), and 14 main scheme Setup lines put one into play (core, aoa, gob, gmw x4, mojo x2, mut_gen, next_evol, sm x2, trors). `PUT_INTO_PLAY` has no environment destination and cannot take a card from the encounter deck.
- Ultron's setup today: put the Ultron Drones environment (`01140`) into play, with environments kept out of the encounter deck through a scenario-specific `excludedEncounterTypes` field; each player's top deck card becomes a facedown Drone minion (1 HP, 1 ATK, 1 SCH, from the environment card's text) engaged with that player. Facedown minions are used by 37 cards in 10 packs; "Drone" appears on 21 cards in core and vision.
- `setupOnomatopoeia` (a log string) is a constructor argument of each plugin.
- Hard-coded `'rhino'`: `game-setup.ts` (four places, plus fallbacks to cards `01094` and `01097b`), `scenario-helpers.ts` (two), `simulation/ability-stage-setter.ts`, `simulation/gauntlet.ts`, `scripts/simulate-games.ts`, and the initial selection in `ScenarioSelector.tsx`.
- `ScenarioRegistry.getAll()` feeds the selector; registration order is import order (Rhino, Klaw, Ultron).
- The `ContentDriver` can list files in a directory but not sub-directories, and the loader does not read `scenarios/` yet.

## 3. Design

### 3.1 Main scheme abilities are resolved from card data (M5b)

The Rules Reference names two moments (Appendix II step 12, and the main scheme entry), and M5b implements both once, for every scenario:

1. **At setup:** run the `SETUP` abilities of main scheme side A (stage 1A), then place stage 1B and run its `WHEN_REVEALED` abilities, through the same effect engine `revealVillainStage` uses, before the villain's reveal.
2. **When the main scheme advances:** run the A-side `WHEN_REVEALED` of the new stage, flip to B, place its starting threat, run the B-side `WHEN_REVEALED`.

Klaw then becomes data (supplemental abilities on `01116a`, `01116b`, `01117a`), and `KlawScenarioPlugin` is deleted; Klaw registers as a plain `DeclarativeScenarioPlugin`, like Rhino. Rhino is unchanged (its main scheme cards need no supplemental data).

**Environment support is built into the engine in the same PR (decided 2026-11-01):**

1. **Reveal:** an environment card revealed from the encounter deck enters play in the villain's play area (`state.environments`) and resolves its When Revealed, like a side scheme, minion or attachment enters play. It is no longer discarded on the spot as if it were a treachery. Nothing else is added: cards and scenario effects that discard, replace or remove an environment keep working through their own effects.
2. **Put into play from data:** as built, no `PUT_INTO_PLAY` change was needed. `SEARCH` with `selectedDestination: TABLEAU` goes through the shared card router (`routeCardInstances`), which now puts an environment into the villain's play area by card type (like a side scheme or a minion), and a `SEARCH` of a deck shuffles it (Search rule).
3. **Ultron's 1A becomes data:** `01137a` Setup puts `01140` into play from the encounter deck and shuffles. The scenario-specific `excludedEncounterTypes` field is not needed and is not added.

**Intentional behavior changes (rules corrections), each covered by a test:**

- **Klaw:** the encounter deck is shuffled after the Defense Network search. This is the Search rule, not just the printed reminder, and it protects hidden information (searching a deck reveals where cards are): "if any portion of a deck is searched, upon completion of that game step, game function, or card ability, shuffle that entire deck" (the engine's `SEARCH` already shuffles a full search by default, today's Klaw code bypasses it); stage 2A's "discard until a minion" is resolved when the scheme advances (today nothing runs it); its starting threat comes from the normal reveal path (verify against the card when implemented). **Bug fix, not a rules change:** today's code creates Defense Network from the catalog when the deck lacks it, and a card cannot be created out of thin air. Defense Network is part of the Klaw set, so it is always among the cards; if the search does not find it (for example it was dealt as a facedown boost or encounter card), the search simply finds nothing, which the engine already handles. The created-card fallback is deleted.
- **Ultron:** the environment is found in the deck and the deck is shuffled afterwards, again by the Search rule (today it is filtered out of the deck without a shuffle), so seeded Ultron games change.
- **All scenarios:** a revealed environment card now enters play instead of being discarded immediately.

The Klaw and Ultron digests are re-recorded in the same PR with these reasons.

### 3.2 Scenario scripts: one Ultron step stays code for now (M5c)

- `ScenarioDefinitionSchema` gains one optional field, `setupOnomatopoeia` (the log text now passed to the plugin constructor).
- A scenario script exports `ScenarioHooks` with one optional member, `resolveStage1BReveal(state, options)` (named in M5b: it runs after the main scheme's own B-side When Revealed and before the villain's reveal). `PackHooks` (the M2 contract) gains `scenarioHooks?: Record<scenarioId, ScenarioHooks>`, replacing the unused `scenarioPlugins` member.
- Every scenario is built as `DeclarativeScenarioPlugin(definition, hooks?)`: the definition from the pack's JSON, the hooks from the same pack's script. `built-in/` is deleted.
- **What is left in `content/packs/core/scripts/scenarios/ultron.ts`** (decided, section 11): the 1B step only, "each player puts the top card of their deck into play facedown, engaged with them as a Drone minion" with the Drone's 1/1/1 stats. It is the reference example in the creator guide ("how a scenario script works"), with the note that user packs cannot ship scripts until the sandbox ADR (Q4). When a shared facedown-minion concept is built (Vision, Gate 2), the script can be revisited.

### 3.3 Scenarios are loaded from packs (M5c)

- `ContentDriver` gets `listDirs(dir)`. The loader reads `packs/<id>/scenarios/<scenarioId>/definition.json`, validates it with `ScenarioDefinitionSchema`, and adds `scenarios` to `LoadedPack`. A duplicate scenario id disables the later pack (shared `ClaimRegistry`).
- `applyContent` registers a `DeclarativeScenarioPlugin` per loaded scenario (with the pack's hooks when it has some); `resetContent` clears `ScenarioRegistry`. The side-effect registration in `scenarios/index.ts` is deleted.
- The registry lists scenarios in ascending `scenarioCardCode` order (Rhino `01094`, Klaw `01113`, Ultron `01134`). A scenario whose `dependsOn` pack is missing is already disabled with a reason (Q22).

### 3.4 Hooks (M5a, done)

Wakanda Forever lives in `content/packs/core/scripts/`, registered through `src/data/content/pack-hooks.generated.ts` (built by `tools/generate-pack-hooks.ts`, run by `schema:generate`); `pack:validate` fails an official pack with scripts but no map entry. Official scripts may import any `@engine` module (bundled at build time, Q16).

### 3.5 No default scenario or fallback card codes in the engine (M5d)

| Today | After |
| --- | --- |
| `options.scenarioId \|\| 'rhino'` in `game-setup.ts` (four places) | `options.scenarioId ?? defaultScenarioId()`: the registered scenario with the lowest `scenarioCardCode`; a clear error when none is registered (zero packs). |
| Fallbacks to cards `01094` and `01097b` | Deleted: a scenario whose villain or scheme is missing is a setup error, not a silent Rhino. |
| `state.scenarioId \|\| 'rhino'` in `scenario-helpers.ts` | Use `state.scenarioId`; setup always sets it. |
| `ability-stage-setter`, `gauntlet`, `simulate-games` | Take the scenario explicitly; the Gauntlet's Gate 1 scope passes the default scenario id. |
| `ScenarioSelector` `useState('rhino')` | First scenario in the registry, or no selection when there are none. |
| `deck-utils.ts` and simulation `'core'` literals (an M3 item M3 did not cover) | The prebuilt deck file name takes the deck's pack code; the simulation and coverage scope default to the enabled packs from the loaded content. |

The cosmetic Rhino branches in `villain-zone-utils.ts` and `comic-log-formatter.ts` belong to M7.

## 4. Simplification & Refactor Check

- **Delete:** `built-in/` (three subclasses), the hard-coded code list in Wakanda Forever (done), the side-effect registrations in `scenarios/index.ts` and `boot.ts`, the `'01094'`/`'01097b'` fallbacks and about a dozen `'rhino'` literals.
- **Merge:** the three scenario classes collapse into one `DeclarativeScenarioPlugin` (+ optional hooks).
- **Reuse, don't add:** Klaw uses `SEARCH` and `DISCARD UNTIL_MATCH`; the engine gains one generic feature (main scheme abilities), not a setup-step vocabulary.
- **No dual paths:** nothing keeps a static scenario import beside the loader.

## 5. Delivery: four PRs, each parity-checked

| PR | Content | Gate |
| --- | --- | --- |
| **M5a** (done, #538) | Hook infrastructure and Wakanda Forever. | Byte-identical `simulate`. |
| **M5b** | Characterization digests first (recorded on `main`), then resolve main scheme Setup and When Revealed from data (setup and advance), **environment support in the engine** (reveal keeps the card in play, `SEARCH` into `TABLEAU` puts a found environment into play), Klaw's and Ultron's 1A supplemental abilities, delete `KlawScenarioPlugin`. | Rhino digests identical; **Klaw and Ultron digests re-recorded on purpose** (shuffles, stage 2A, Defense Network); `simulate` byte-identical; full suite. |
| **M5c** | `PackHooks.scenarioHooks`, `setupOnomatopoeia`, `listDirs`, scenario loading and registration, the Ultron 1B script (decision 4), registry order, delete `built-in/`. | Digests for all three scenarios identical to M5b's; `simulate` byte-identical; full suite. |
| **M5d** | `defaultScenarioId()`, removal of the `'rhino'` literals and fallback cards, selector default, the `'core'` literals, zero-pack tests. | Full suite; `simulate` byte-identical; zero-pack smoke test still renders. |

## 6. File changes (summary)

| Area | M5b | M5c | M5d |
| --- | --- | --- | --- |
| `src/engine/scenarios/`, `src/engine/pipeline/villain-phase.ts`, `src/engine/effects/card-routing.ts`, `src/engine/state/environment.ts` | `declarative-plugin.ts` (resolve main scheme abilities), environment reveal and the card router, `index.ts` (Klaw plain), delete `built-in/klaw/` | `declarative-plugin.ts` (hooks), `registry.ts`, `index.ts`; delete `built-in/` | `default-scenario.ts` |
| `content/packs/core/supplemental/core_encounter.json` | abilities on `01116a`, `01116b`, `01117a`, `01137a` | | |
| `src/data/packs/scenario-definition.ts` (+ generated schema) | | `setupOnomatopoeia` | |
| `src/engine/plugin-api/index.ts` | | `scenarioHooks`, `ScenarioHooks` | |
| `src/data/content/` | | `loader.ts` (+ `scenarios`), `apply.ts`, `types.ts`, drivers (`listDirs`) | |
| `content/packs/core/scenarios/*/definition.json` | | `setupOnomatopoeia` | |
| `content/packs/core/scripts/` | | `scenarios/ultron.ts`, `index.ts` | |
| `src/engine/state/game-setup.ts`, `pipeline/scenario-helpers.ts`, `simulation/*`, `scripts/simulate-games.ts`, `ScenarioSelector.tsx`, `engine/decks/deck-utils.ts` | | | edits |
| `docs/guidelines/scenario_creation_guide.md`, hero guide | main scheme Setup / When Revealed and environments in data | "how a scenario script works" (Ultron) | |
| `changes/unreleased/` | fragment | fragment | fragment |

## 7. Tests

- **Characterization first (start of M5b):** `tests/engine/scenario-setup-digests.test.ts` runs `onGameSetup` for Rhino, Klaw and Ultron (1 and 2 players, Standard and Expert, fixed seed) and compares a digest of the resulting state with golden values recorded from current `main`. Its first commit passes against unchanged code.
- **M5b:** main scheme Setup and When Revealed at setup and on advance (including Klaw's stage 2A); `DISCARD UNTIL_MATCH` for a minion engaging the first player; the Defense Network search with shuffle; a main scheme without abilities (Rhino) is a no-op; **environments:** a revealed environment enters `state.environments` instead of the discard pile (and an effect that discards one still can), `SEARCH` into `TABLEAU` puts an environment into play (and shuffles the deck), Ultron's 1A puts `01140` into play.
- **M5c:** `tests/engine/scenario-scripts.test.ts` (Ultron's 1B keeps its behavior), scenario schema fields, loader scenarios (loaded, validated, bad definition disables its pack, duplicate id), `applyContent`/`resetContent` registration and clearing.
- **M5d:** `defaultScenarioId()` ordering and zero-scenario error; the zero-pack smoke test renders with no selection.

## 8. Verification (once per PR, after the last edit)

`tsc`, lint, format, `docs:check`, `deadcode`, `pack:validate -- content/packs`, the full `npm test`, and `npm run simulate -- --no-stats` compared byte for byte with a clean `main` run (card data hash `362be14e`, 185 abilities, 20 Gauntlet matches). Browser check of the dev app for M5b to M5d (the selector lists Rhino, Klaw and Ultron, a game starts for each). `npm run simulate -- --balance` cannot be compared until #534 is fixed.

## 9. Debt Removed

- Three scenario classes (subclassing for two hooks), a scenario-specific `excludedEncounterTypes` hack, an environment zone that only Ultron's plugin could fill, and (Ultron's Drone step stays a script, decision 4) a Drone literal built inside engine code.
- The engine ignoring main scheme Setup and When Revealed text, which also left Klaw's stage 2A reveal unimplemented.
- Hard-coded Core card codes in the engine (`01094`, `01097b`, `01124`, `01140`).
- About a dozen `'rhino'` defaults that made the engine unable to start without Rhino.
- Side-effect registration at import time (scenarios and the special handler).

## 10. UI and Card Editor impact

The scenario selector reads the same registry and shows the same three scenarios in the same order; it starts with no selection when there are none (the polished empty state is M7). Klaw's setup is now editable data in the Card Supplemental Editor. The creator-facing scenario guide gains the main scheme Setup / When Revealed reference and a worked scenario script (Ultron), next to the card script example (Wakanda Forever).

## 11. Decisions and open points

Decided (2026-11-01):

1. **Uniqueness decides where code lives (Q49).** Wakanda Forever is a script, and so is Ultron's one facedown-Drone step (decision 4); everything the existing primitives and the engine's built-in concepts can express is data.
2. **Klaw is data.** Evidence in the [Klaw review](klaw_setup_as_data_review.md): every step exists as data, and the one missing piece is generic.
3. **Environment support is built into the engine, not scenario code** (91 cards, 16 packs). A revealed environment enters play like any other card type, and a `SEARCH` into `TABLEAU` puts one into play from data.
4. **Ultron's facedown Drone step (1B) is a script now.** The Vision pack reproduces the Ultron concept in its nemesis set, so similar code will live in the Vision pack too; that is the exception that confirms the uniqueness rule, not a reason for an engine concept yet. Vision is tackled when it is integrated, at which point a shared facedown-minion concept can be revisited (with the Gate 2 plug-in work, #275). (Decided 2026-11-01.)

Decided as recommended (the plan was approved "as recommended" on 2026-11-01, and the behavior changes in point 5 were accepted):

5. **The behavior changes** (Klaw: shuffle, stage 2A; Ultron: environment found in the deck then shuffle; a revealed environment enters play instead of being discarded). The created-from-nothing Defense Network is removed as a bug, not offered as a choice. **Recommend accepting them**: they are what the printed cards and the rules say.
6. **What may official hook scripts import?** **Recommend any `@engine` module** (build-time, trusted); a stricter barrel comes with the sandbox ADR.
7. **Default scenario.** **Recommend the lowest `scenarioCardCode`**, with a clear error when none is registered.
8. **`'core'` literals** go into M5d (section 3.5). **Recommend yes.**

## 12. Done when

No file under `src/engine` names a Core card code or `'rhino'`, `built-in/` is gone, scenarios and hooks register through the loader, the zero-pack boot still works, and the setup digests and `npm run simulate` output match `main` (Klaw's digests changed only for the three stated reasons).

## 13. As built (M5a: PR #538, M5b: PR #540, M5c)

Where the merged code differs from the plan above, or what the next implementer must know:

**M5a (hooks and Wakanda Forever)**

1. `scenarioHooks` was not added to `PackHooks` in M5a (nothing used it); it arrives in M5c.
2. Added `clearSpecialHandlers()` to `special-registry.ts`; `applyContent` registers the special handlers of the loaded packs through `src/data/content/pack-hooks.generated.ts` and `resetContent` clears them. `pack:validate` fails an official pack with `scripts/` but no `index.ts` (`hooks-index`) or no map entry (`hooks-map`). `content/**/*.ts` is part of `tsconfig`, `lint` and `knip`.

**M5b (main scheme abilities, Klaw as data, environments)**

1. **Hook name.** The base class method is `resolveStage1BReveal(state, options)`, called after the main scheme's B-side When Revealed and before the villain's reveal. Ultron's subclass overrides it (the facedown Drones). M5c turns exactly this into the `ScenarioHooks` member.
2. **No `PUT_INTO_PLAY` change.** An environment enters play through `SEARCH` into `TABLEAU` (shared router `src/engine/effects/card-routing.ts`) or when revealed (`villain-phase.ts`), both through `putEnvironmentIntoPlay` in `src/engine/state/environment.ts`. The log key `scenario.setup.environment` became `environment.entersPlay` (typed in `log-events.ts`, both locales, `rule-observations.ts`, `rule-scenarios.ts`).
3. **`SETUP` abilities have no `trigger`.** Only `timing: "SETUP"` (the schema rejects `trigger: "SETUP"`). A pack that fails schema validation is disabled, so a bad entry empties the catalog: the test setup (`tests/setup/load-content.ts`) now throws with the reason.
4. **Defense Network is `01125`**, a side scheme. The old Klaw code used `01124`, which is Sound Manipulation (a treachery), pulled it out of the deck and put it in play as a "side scheme"; the old test asserted that. Fixed with the move to data.
5. **Data added** to `content/packs/core/supplemental/core_encounter.json`: `01116a` (`SEARCH` Defense Network, `REVEAL`), `01116b` and `01117a` (`DISCARD` `UNTIL_MATCH` minion, `PLAY`, first player), `01137a` (`SEARCH` the Ultron Drones environment `01140`, `TABLEAU`). `excludedEncounterTypes` is gone from `DeclarativeScenarioPlugin`.
6. **Coverage harness.** `exerciseMainSchemeSetup` in `ability-stage-setter.ts` verifies a main scheme's Setup by what ends up in `sideSchemes` or `environments`. `tests/data/setup-ability-owners.test.ts` now allows `SETUP` on identity cards and on main scheme A sides.
7. **Parity numbers (reference for M5c and M5d).** `npm run simulate -- --no-stats` after M5b: 189 abilities in scope (was 185: +2 `SETUP`, +2 `WHEN_REVEALED`), card data hash `1c9bff57` (was `362be14e`), Gauntlet 20/20 clean with 100 abilities seen, rule coverage 143/257 observed, replay catalog 307 entries (the 301 earlier recipes unchanged except their hash, plus 6 new). Re-measure the baseline on `main` after M5b is merged, with `--no-stats` on both sides (a local `stats/` file steers the Gauntlet and makes runs incomparable).
8. **Digests.** `tests/engine/scenario-setup-digests.test.ts` holds 12 golden digests (3 scenarios x 1 and 2 players x Standard and Expert). Rhino's were recorded on `main` before M5b and did not change; Klaw's and Ultron's were re-recorded with their reasons in the file. M5c must leave all 12 unchanged.
9. **Docs updated:** `02_timings_and_triggers.md` (SETUP row) and `scenario_creation_guide.md` (new Step 1b: main scheme abilities and environments as data). The rest of that guide (folder layout under `src/`, the `plugin.ts` lifecycle section) is still the pre-pack description and is rewritten in M5c.

**M5c (scenarios from packs, Ultron script, `built-in/` deleted)**

1. **Built as planned**: `listDirs` (Node and fetch drivers), `setupOnomatopoeia` in the definition schema and the three definitions, scenarios in `LoadedPack` with the loader's duplicate-id and invalid-definition rules (a scenario folder without `definition.json` also disables its pack), `PackHooks.scenarioHooks` and `ScenarioHooks.resolveStage1BReveal`, a single `DeclarativeScenarioPlugin(definition, hooks?)`, `content/packs/core/scripts/scenarios/ultron.ts`, `applyContent`/`resetContent`, `ScenarioRegistry.getAll()` in scenario card code order, `built-in/` deleted, guide rewritten. `src/engine/boot.ts` still imports `./scenarios` (the registry and plugin class); nothing there registers scenarios any more.
2. **Small addition (not a deviation of the design):** with no pack loaded the registry is now empty, which the `ScenarioSelector` could not render (it read `scenarios[0]`). M5c adds a text-only "No scenario available" state in `ScenarioSelector`; the polished empty state stays M7, and the preselected-scenario change stays M5d. The zero-pack smoke test asserts it.
3. **Parity:** 12 digests unchanged; `simulate --no-stats` replay catalog and summary byte-identical to `main` at `df880be`. Browser check: selector lists Rhino, Klaw, Ultron in that order and a game starts for each; Ultron's board shows the Drone text and no console errors (card images 404 only because the sandbox has no image cache).
4. `pack-validate.ts` already validated scenario definitions and duplicate ids with the same `ClaimRegistry`; nothing to change there.

## 14. Checklist for M5c and M5d

### In-Game Scenarios for M5c and M5d

**M5c**

**Setup:** Spider-Man (Peter Parker, alter-ego form), one player, Standard difficulty, on the scenario screen; Core is the only enabled pack.
**Player does:** Picks Ultron in the selector, starts the mission, confirms the opening hand and looks at the board. Then does the same for Klaw and for Rhino.
**Today:** The three scenarios exist because the engine is built with them; the board shows Ultron at stage I, the Ultron Drones environment in play and one facedown Drone minion engaged with Spider-Man.
**After this change:** The same boards, in the same order in the selector (Rhino, Klaw, Ultron). The scenarios now come from the Core pack's files, so a scenario whose pack is not loaded is not offered.
**Why (rules):** RR v1.8 Appendix II step 12: Ultron's stage 1B When Revealed puts the top card of each player's deck into play facedown, engaged, as a Drone minion; nothing about the rules changes.
**Also covers:** Klaw and Rhino games start exactly as before (the 12 setup digests are unchanged); a scenario that needs a missing pack is disabled with a reason.

**M5d**

**Setup:** The app opens with Core enabled, then with no pack enabled at all.
**Player does:** Opens the scenario screen and starts a mission.
**Today:** The screen preselects Rhino and game setup assumes Rhino, even falling back to card `01094` when Rhino is not there.
**After this change:** The preselected scenario is the first one available (Rhino with Core enabled). With no pack enabled there is no scenario to preselect, and starting a mission says no scenario is available instead of silently using Rhino.
**Why (rules):** None: the player always chooses the scenario; this is about not hiding a missing one.
**Also covers:** Simulations and tests that never named a scenario still run Rhino through the default.

**M5c: scenarios from packs, Ultron as the one script, delete `built-in/`**

1. `ContentDriver.listDirs(dir)`: Node (`readdir` with dirents), fetch (derived from `index.json`), update any test that stubs a `ContentDriver`.
2. `ScenarioDefinitionSchema` (+ regenerate `scenario.schema.json`): optional `setupOnomatopoeia`; move the three log strings (`THE BREAK-IN BEGINS!`, `UNDERGROUND DISTRIBUTION COMMENCES!`, `ULTRON ONLINE! DRONES INITIALIZED!`) from the plugin constructors into the three `definition.json` files.
3. Loader: read `packs/<id>/scenarios/<scenarioId>/definition.json`, validate, add `scenarios` to `LoadedPack`; duplicate scenario id disables the later pack (`ClaimRegistry`); `pack-validate.ts` shares the check.
4. `PackHooks`: replace `scenarioPlugins` with `scenarioHooks?: Record<string, ScenarioHooks>`; `ScenarioHooks { resolveStage1BReveal?(state, options): GameState }`.
5. `DeclarativeScenarioPlugin(definition, hooks?)`: the base method delegates to `hooks?.resolveStage1BReveal`; delete the three `built-in/*/plugin.ts` classes, their exports and the side-effect registration in `scenarios/index.ts` (check `engine/boot.ts` still reaches what ADR-0088's boot test requires).
6. `applyContent` registers one plugin per loaded scenario with the hooks of the same pack (from `packHooks`), `resetContent` calls `ScenarioRegistry.clear()`; `ScenarioRegistry.getAll()` returns scenarios in ascending `scenarioCardCode`.
7. `content/packs/core/scripts/scenarios/ultron.ts`: the Drone code from `built-in/ultron/plugin.ts` (including `createDroneMinionInstance`) unchanged in behavior, exported through `scripts/index.ts` as `scenarioHooks: { ultron: ... }`, then `npm run schema:generate` (the hook map).
8. Tests that import the classes or `rhinoPlugin`/`klawPlugin`/`ultronPlugin` (`scenario-plugin`, `scenario-plugins-klaw-ultron`, `klaw-immortal-side-scheme`, `villain-stage-change`, `scenario-modular-customization`, `tests/ui/scenario-selector.test.tsx`) switch to `ScenarioRegistry.get(...)`; new tests for `listDirs`, loader scenarios (loaded, invalid definition disables only its pack, duplicate id), registration and clearing in `applyContent`/`resetContent`, and the Ultron script.
9. Docs: rewrite `docs/guidelines/scenario_creation_guide.md` for the pack layout and add "how a scenario script works" with Ultron as the example; note that user packs cannot ship scripts (Q4).
10. Gate: the 12 digests unchanged, `simulate --no-stats` byte-identical to `main` after M5b, full suite, browser check that the selector lists Rhino, Klaw and Ultron and a game starts for each.

**M5d: defaults and literals**

Exactly section 3.5: `defaultScenarioId()` (lowest `scenarioCardCode`, clear error when none registered), remove the `'rhino'` literals and the `'01094'`/`'01097b'` fallbacks in `game-setup.ts`, `state.scenarioId` without default in `scenario-helpers.ts`, explicit scenario in `ability-stage-setter`, `gauntlet`, `simulate-games`, first registry scenario as the `ScenarioSelector` default, `deck-utils.ts` and simulation `'core'` literals (decision 8). Gate: full suite, `simulate --no-stats` byte-identical, the zero-pack smoke test still renders.
