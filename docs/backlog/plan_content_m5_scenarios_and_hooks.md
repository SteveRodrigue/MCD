# Plan — M5: Scenarios and hooks come from packs

**Status:** M5a implemented (PR #538). M5b to M5d: draft for review (2026-11-01), revised the same day after the [Klaw review](klaw_setup_as_data_review.md). Stop for approval before implementing M5b.
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (Q4, Q16, Q17, Q33, Q49; section 3.3 and 3.4) and [ADR-0092](../decisions/0092-content-packs-and-runtime-loading.md).
**Depends on:** M2 (schemas, `PackHooks`), M4 (content layout), M3 (runtime loader) and M5a (hook map), all merged.
**Gate note:** Gate 1 (Rhino) is still active. M5 touches the Rhino setup path, so every PR below is gated by byte-identical `simulate` output and by seeded setup digests for all three scenarios.

## 1. Goal

After M5 no scenario or card-specific code lives in the engine. A scenario is a `definition.json` in its pack and is registered when the pack loads. **Uniqueness decides where code lives (Q49):**

- What the existing effect primitives can express is **data**. Klaw's setup is printed text on its main scheme cards and every effect in it already exists, so Klaw is data.
- What only one scenario or card needs, and cannot be expressed generically, is a **script** in its pack, found through the generated hook map: Wakanda Forever (done in M5a) and Ultron's setup (it needs a facedown Drone minion concept that belongs to the Gate 2 plug-in work, #275). Ultron is the worked example of a scenario script.
- The engine keeps only generic behavior, and nothing in `src/engine` names a Core card code or defaults to `'rhino'`.

## 2. Facts (verified 2026-11-01 on `main`)

- `src/engine/scenarios/built-in/{rhino,klaw,ultron}/plugin.ts` are the only scenario code: Rhino is a bare `DeclarativeScenarioPlugin`; Klaw and Ultron subclass it for stage 1A setup only. They are registered by side effect in `scenarios/index.ts`; `definition.json` is already loaded from `content/packs/core/scenarios/<id>/`.
- `DeclarativeScenarioPlugin.onGameSetup` sets the main scheme directly to stage 1B and never resolves a main scheme's Setup or When Revealed; `onMainSchemeCompleted` swaps the card and logs, also without resolving anything. Only a villain's When Revealed runs from data (`revealVillainStage` through `kernel.executeEffect`).
- Klaw's printed setup is `SEARCH` (Defense Network, reveal, shuffle) and `DISCARD ... UNTIL_MATCH` (minion, into play, first player); both already exist as data (Klaw II `01114` and The Masters of Evil `01128`). **62 main scheme A sides in 17 packs have a `Setup:` line**; 15 cards use "discard until a minion". See the [Klaw review](klaw_setup_as_data_review.md).
- Ultron's setup: put the Ultron Drones environment (`01140`) into play; each player's top deck card becomes a facedown Drone minion (1 HP, 1 ATK, 1 SCH) engaged with that player; environments stay out of the encounter deck (`excludedEncounterTypes`). `PUT_INTO_PLAY` has no environment destination and no facedown-minion option.
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

**Intentional behavior changes for Klaw (rules corrections), each covered by a test:** the encounter deck is shuffled after the Defense Network search (printed text); stage 2A's "discard until a minion" is resolved when the scheme advances (today nothing runs it); a missing Defense Network is no longer created; its starting threat comes from the normal reveal path (verify against the card when implemented). The Klaw digests are re-recorded in the same PR with these reasons.

### 3.2 Scenario scripts: only Ultron stays code (M5c)

- `ScenarioDefinitionSchema` gains two optional fields: `setupOnomatopoeia` (the log text now passed to the plugin constructor) and `excludedEncounterTypes` (Ultron: `["environment"]`).
- A scenario script exports `ScenarioHooks` with one optional member, `resolveStage1ASetup(state, options)`. `PackHooks` (the M2 contract) gains `scenarioHooks?: Record<scenarioId, ScenarioHooks>`, replacing the unused `scenarioPlugins` member.
- Every scenario is built as `DeclarativeScenarioPlugin(definition, hooks?)`: the definition from the pack's JSON, the hooks from the same pack's script. `content/packs/core/scripts/scenarios/ultron.ts` holds today's Ultron setup unchanged in behavior (the Drone's name, traits and stats are built inside it). It is the reference example in the creator guide ("how a scenario script works"), with the note that user packs cannot ship scripts until the sandbox ADR (Q4). `built-in/` is deleted.

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
| **M5b** | Characterization digests first (recorded on `main`), then resolve main scheme Setup and When Revealed from data (setup and advance), Klaw's supplemental abilities, delete `KlawScenarioPlugin` (Klaw registers as a plain declarative plugin). | Rhino and Ultron digests identical; **Klaw digests re-recorded on purpose** (shuffle, stage 2A, Defense Network); `simulate` byte-identical; full suite. |
| **M5c** | `PackHooks.scenarioHooks`, `setupOnomatopoeia`/`excludedEncounterTypes`, `listDirs`, scenario loading and registration, Ultron script, registry order, delete `built-in/`. | Digests for all three scenarios identical to M5b's; `simulate` byte-identical; full suite. |
| **M5d** | `defaultScenarioId()`, removal of the `'rhino'` literals and fallback cards, selector default, the `'core'` literals, zero-pack tests. | Full suite; `simulate` byte-identical; zero-pack smoke test still renders. |

## 6. File changes (summary)

| Area | M5b | M5c | M5d |
| --- | --- | --- | --- |
| `src/engine/scenarios/` | `declarative-plugin.ts` (resolve main scheme abilities), `index.ts` (Klaw plain), delete `built-in/klaw/` | `declarative-plugin.ts` (hooks), `registry.ts`, `index.ts`; delete `built-in/` | `default-scenario.ts` |
| `content/packs/core/supplemental/core_encounter.json` | abilities on `01116a`, `01116b`, `01117a` | | |
| `src/data/packs/scenario-definition.ts` (+ generated schema) | | new optional fields | |
| `src/engine/plugin-api/index.ts` | | `scenarioHooks`, `ScenarioHooks` | |
| `src/data/content/` | | `loader.ts` (+ `scenarios`), `apply.ts`, `types.ts`, drivers (`listDirs`) | |
| `content/packs/core/scenarios/*/definition.json` | | new fields | |
| `content/packs/core/scripts/` | | `scenarios/ultron.ts`, `index.ts` | |
| `src/engine/state/game-setup.ts`, `pipeline/scenario-helpers.ts`, `simulation/*`, `scripts/simulate-games.ts`, `ScenarioSelector.tsx`, `engine/decks/deck-utils.ts` | | | edits |
| `docs/guidelines/scenario_creation_guide.md`, hero guide | main scheme Setup / When Revealed in data | "how a scenario script works" (Ultron) | |
| `changes/unreleased/` | fragment | fragment | fragment |

## 7. Tests

- **Characterization first (start of M5b):** `tests/engine/scenario-setup-digests.test.ts` runs `onGameSetup` for Rhino, Klaw and Ultron (1 and 2 players, Standard and Expert, fixed seed) and compares a digest of the resulting state with golden values recorded from current `main`. Its first commit passes against unchanged code.
- **M5b:** main scheme Setup and When Revealed at setup and on advance (including Klaw's stage 2A); `DISCARD UNTIL_MATCH` for a minion engaging the first player; the Defense Network search with shuffle; a main scheme without abilities (Rhino) is a no-op.
- **M5c:** `tests/engine/scenario-scripts.test.ts` (Ultron keeps its behavior), scenario schema fields, loader scenarios (loaded, validated, bad definition disables its pack, duplicate id), `applyContent`/`resetContent` registration and clearing.
- **M5d:** `defaultScenarioId()` ordering and zero-scenario error; the zero-pack smoke test renders with no selection.

## 8. Verification (once per PR, after the last edit)

`tsc`, lint, format, `docs:check`, `deadcode`, `pack:validate -- content/packs`, the full `npm test`, and `npm run simulate -- --no-stats` compared byte for byte with a clean `main` run (card data hash `362be14e`, 185 abilities, 20 Gauntlet matches). Browser check of the dev app for M5b to M5d (the selector lists Rhino, Klaw and Ultron, a game starts for each). `npm run simulate -- --balance` cannot be compared until #534 is fixed.

## 9. Debt Removed

- Three scenario classes (subclassing for two hooks) and a Drone literal built inside engine code.
- The engine ignoring main scheme Setup and When Revealed text, which also left Klaw's stage 2A reveal unimplemented.
- Hard-coded Core card codes in the engine (`01094`, `01097b`, `01124`, `01140`).
- About a dozen `'rhino'` defaults that made the engine unable to start without Rhino.
- Side-effect registration at import time (scenarios and the special handler).

## 10. UI and Card Editor impact

The scenario selector reads the same registry and shows the same three scenarios in the same order; it starts with no selection when there are none (the polished empty state is M7). Klaw's setup is now editable data in the Card Supplemental Editor. The creator-facing scenario guide gains the main scheme Setup / When Revealed reference and a worked scenario script (Ultron), next to the card script example (Wakanda Forever).

## 11. Decisions and open points

Decided (2026-11-01):

1. **Uniqueness decides where code lives (Q49).** Wakanda Forever and Ultron are scripts; everything the existing primitives can express is data.
2. **Klaw is data.** Evidence in the [Klaw review](klaw_setup_as_data_review.md): every step exists as data, and the one missing piece is generic.

Open, each with a recommendation:

3. **Klaw's behavior changes** (shuffle, stage 2A reveal, no created Defense Network). **Recommend accepting them**: they are what the printed cards and the rules say.
4. **What may official hook scripts import?** **Recommend any `@engine` module** (build-time, trusted); a stricter barrel comes with the sandbox ADR.
5. **Default scenario.** **Recommend the lowest `scenarioCardCode`**, with a clear error when none is registered.
6. **`'core'` literals** go into M5d (section 3.5). **Recommend yes.**
7. **Ultron's 1A environment and 1B facedown Drone** stay script code until the Gate 2 plug-in work (#275) adds an environment destination and a facedown-minion concept. **Recommend this.**

## 12. Done when

No file under `src/engine` names a Core card code or `'rhino'`, `built-in/` is gone, scenarios and hooks register through the loader, the zero-pack boot still works, and the setup digests and `npm run simulate` output match `main` (Klaw's digests changed only for the three stated reasons).
