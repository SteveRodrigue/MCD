# Plan — M5: Scenarios and hooks come from packs

**Status:** Draft for review (2026-11-01). Source, test, data and configuration changes; stop for approval before implementation.
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (Q4, Q16, Q17, Q33; section 3.3 and 3.4) and [ADR-0092](../decisions/0092-content-packs-and-runtime-loading.md).
**Depends on:** M2 (schemas, `PackHooks`), M4 (content layout) and M3 (runtime loader), all merged.
**Gate note:** Gate 1 (Rhino) is still active. M5 touches the Rhino setup path, so every PR below is gated by byte-identical simulation output and by seeded setup digests for all three scenarios.

## 1. Goal

After M5 no scenario or card-specific code lives in the engine. A scenario is a `definition.json` in its pack and is registered when the pack loads. **Uniqueness decides where code lives:** logic that only one scenario or one card needs is a script in that pack's `scripts/` folder (Ultron's and Klaw's setup, Wakanda Forever), found through a generated import map; the engine keeps only generic behavior. Ultron becomes the worked example of a scenario script, as Wakanda Forever is for a card script. Nothing in `src/engine` names a Core card code or defaults to `'rhino'`.

## 2. Facts (verified 2026-11-01 on `main` at `e8afe802`)

- `src/engine/scenarios/built-in/{rhino,klaw,ultron}/plugin.ts` are the only scenario code: Rhino is a bare `DeclarativeScenarioPlugin`; Klaw and Ultron subclass it for stage 1A setup only. They are registered by side effect in `scenarios/index.ts`, and `definition.json` is already loaded from `content/packs/core/scenarios/<id>/`.
- Klaw's setup: put side scheme `01124` into play (from the encounter deck, else created), threat = base threat x players; then discard encounter cards until a minion is discarded and engage it with the first player.
- Ultron's setup: put environment `01140` into play; the top card of each player's deck becomes a facedown Drone minion (1 HP, 1 ATK, 1 SCH, trait Drone) engaged with that player; environments are kept out of the encounter deck (`excludedEncounterTypes`).
- `setupOnomatopoeia` (a log string) is a constructor argument of each plugin.
- `src/engine/specials/wakanda-forever.ts` registers the only special handler by side effect (`boot.ts` imports it). It hard-codes `BLACK_PANTHER_UPGRADE_CODES = ['01046'..'01049']`, but all four cards carry the trait *Black Panther*, which the same filter already checks, so the list is redundant.
- Hard-coded `'rhino'`: `game-setup.ts` (four places, plus fallbacks to card `01094` and `01097b`), `scenario-helpers.ts` (two), `simulation/ability-stage-setter.ts`, `simulation/gauntlet.ts`, `scripts/simulate-games.ts`, and the initial selection in `ScenarioSelector.tsx`.
- `ScenarioRegistry.getAll()` feeds the selector. Registration order is currently import order, which happens to be Rhino, Klaw, Ultron.
- Tests that cover these plugins: `scenario-plugin`, `scenario-plugins-klaw-ultron`, `klaw-immortal-side-scheme`, `scenario-modular-customization`, `villain-stage-change`, and `tests/ui/scenario-selector.test.tsx`.
- The `ContentDriver` can list files in a directory but not sub-directories, and the loader does not read `scenarios/` yet.

## 3. Design

### 3.1 Scenario scripts: only the unique part is code (decided 2026-11-01)

Ultron's stage 1A setup is a one-off mechanic, so it is a script in the Core pack, not an engine primitive. **Klaw was checked (2026-11-01) and cannot be data yet.** Its setup is the printed text of main scheme `01116a`/`b` and `01117a`, and the engine does not resolve a main scheme's Setup or When Revealed abilities from card data (nor is there a "discard until a minion" primitive, nor does today's code shuffle as the printed text requires). The full analysis and the options are in [`klaw_setup_script_review.md`](klaw_setup_script_review.md). **Proposed, pending that review:** Klaw is a script like Ultron, unchanged in behavior, and becomes data when the Gate 2 scenario plug-in work (#275) delivers the generic features. Everything generic stays data:

- `ScenarioDefinitionSchema` gains two optional fields: `setupOnomatopoeia` (the log text now passed to the plugin constructor) and `excludedEncounterTypes` (Ultron: `["environment"]`). Rhino needs neither script nor setup code.
- A scenario script exports a `ScenarioHooks` object with one optional member, `resolveStage1ASetup(state, options)`, the only override point the subclasses use. `PackHooks` (the M2 contract) gains `scenarioHooks?: Record<scenarioId, ScenarioHooks>`.
- The engine builds every scenario as a `DeclarativeScenarioPlugin(definition, hooks?)`: the definition comes from the pack's JSON and the hooks from the same pack's script. The three subclasses and `built-in/` are deleted.
- `content/packs/core/scripts/scenarios/ultron.ts` (and `klaw.ts`, proposed) hold today's setup code unchanged in behavior; the Drone (name, traits, stats) is built inside it. It becomes the reference example in the creator guide ("how a scenario script works"), with the note that user packs cannot ship scripts until the sandbox ADR (Q4). `klaw.ts` is the same kind of file (proposed); both go away when main scheme Setup and When Revealed abilities become data.

### 3.2 Scenarios are loaded from packs

- `ContentDriver` gets `listDirs(dir)` (Node: directory entries; fetch: derived from the index). The loader reads `packs/<id>/scenarios/<scenarioId>/definition.json`, validates it with `ScenarioDefinitionSchema`, and adds `scenarios` to `LoadedPack`. A duplicate scenario id disables the later pack (shared `ClaimRegistry`, as for cards).
- `applyContent` registers a `DeclarativeScenarioPlugin` for each loaded scenario, with the hooks of the same pack when its script exports some; `resetContent` clears `ScenarioRegistry`. The side-effect registration in `scenarios/index.ts` is deleted.
- The registry lists scenarios in ascending `scenarioCardCode` order (Rhino `01094`, Klaw `01113`, Ultron `01134`), so order no longer depends on import or file order.
- A scenario whose `dependsOn` pack is missing is already disabled with a reason by the loader (Q22).

### 3.3 Hooks: generated import map and Wakanda Forever (Q16, Q33)

- A pack with code keeps it in `scripts/index.ts`, which default-exports `PackHooks` (`scenarioHooks?`, `specialHandlers?`; the M2 `scenarioPlugins` member is replaced, since no pack needs to supply a whole plugin). `tools/generate-pack-hooks.ts` scans `content/packs/*/scripts/index.ts` and writes `src/data/content/pack-hooks.generated.ts`, a static import map keyed by pack id. It runs with `schema:generate` (so on `dev`, `build` and `verify`), and a test fails when the checked-in file is out of date.
- `applyContent` registers the hooks of each loaded pack (special handlers into the special registry, scenario hooks into the scenario plugins it builds); `resetContent` clears them.
- `pack:validate` fails a pack that has `scripts/` but no map entry (Q33), and still rejects `scripts/` in `user` packs (Q16).
- Wakanda Forever moves to `content/packs/core/scripts/wakanda-forever.ts` and `index.ts` (which later also exports the Klaw and Ultron hooks). `src/engine/specials/wakanda-forever.ts` and its `boot.ts` import are deleted; `special-registry.ts` stays (generic). `BLACK_PANTHER_UPGRADE_CODES` is dropped (trait filter only).
- Tooling for `content/**/scripts`: add it to `tsconfig` includes, the `lint` script, and `knip` entries.

### 3.4 No default scenario or fallback card codes in the engine

| Today | After |
| --- | --- |
| `options.scenarioId \|\| 'rhino'` in `game-setup.ts` (four places) | `options.scenarioId ?? defaultScenarioId()`: the first registered scenario by card code; a clear error when no scenario is registered (zero packs). |
| Fallbacks to cards `01094` and `01097b` | Deleted: a scenario whose villain or scheme is missing is a setup error, not a silent Rhino. |
| `state.scenarioId \|\| 'rhino'` in `scenario-helpers.ts` | Use `state.scenarioId`; it is always set by setup. |
| `ability-stage-setter`, `gauntlet`, `simulate-games` | Take the scenario explicitly; the Gauntlet's Gate 1 scope passes the default scenario id. |
| `ScenarioSelector` `useState('rhino')` | First scenario in the registry, or no selection when there are none. |

The cosmetic Rhino branches in `villain-zone-utils.ts` and `comic-log-formatter.ts` are label and icon maps; they belong to M7 and are out of scope here.

## 4. Simplification & Refactor Check

- **Delete:** `built-in/` (the scenario subclasses are replaced by two scripts in the pack), `specials/wakanda-forever.ts`'s hard-coded code list, the side-effect registrations in `scenarios/index.ts` and `boot.ts`, the `'01094'`/`'01097b'` fallbacks and about a dozen `'rhino'` literals.
- **Merge:** the three scenario classes collapse into the one `DeclarativeScenarioPlugin` (+ optional hooks); the Drone's hard-coded stats leave the engine.
- **No new engine vocabulary:** unique setup logic stays code in its pack, so the engine gains no setup steps that only one scenario uses.
- **No dual paths:** nothing keeps a static scenario import beside the loader; if a pack is not loaded its scenarios do not exist.

## 5. Delivery: three PRs, each parity-checked

| PR | Content | Gate |
| --- | --- | --- |
| **M5a** | Hook infrastructure and Wakanda Forever: `PackHooks` with `scenarioHooks`, `tools/generate-pack-hooks.ts` and the generated map, hook registration in `applyContent`/`resetContent`, `pack:validate` rule, Wakanda Forever and the Core `scripts/index.ts`, tooling includes. | Existing Wakanda Forever tests unchanged; map-sync test; `simulate` byte-identical. |
| **M5b** | Characterization digests first (recorded on current `main`), then `listDirs`, scenario loading and registration, `setupOnomatopoeia`/`excludedEncounterTypes`, Ultron script and the proposed Klaw script, registry order, deletion of `built-in/`. | Setup digests for 3 scenarios x 1 and 2 players x 2 difficulties identical; `simulate` byte-identical; full suite. |
| **M5c** | `defaultScenarioId()`, removal of the `'rhino'` literals and fallback cards, selector default, `deck-utils` and simulation `'core'` literals (decision 4), zero-pack tests. | Full suite; `simulate` byte-identical; zero-pack smoke test still renders. |

The digest test is written at the start of M5b, but because it only needs current `main` it can be committed first inside that PR (its first commit passes against unchanged code).

## 6. File changes (summary)

| Area | M5a | M5b | M5c |
| --- | --- | --- | --- |
| `src/data/packs/scenario-definition.ts` (+ generated `scenario.schema.json`) | | `setupOnomatopoeia`, `excludedEncounterTypes` | |
| `src/engine/plugin-api/index.ts` | `scenarioHooks`, `ScenarioHooks` | | |
| `src/engine/scenarios/` | | `declarative-plugin.ts` (hooks), `registry.ts`, `index.ts`; delete `built-in/` | `default-scenario.ts` |
| `src/data/content/` | `apply.ts`, `pack-hooks.generated.ts` | `loader.ts` (+ `scenarios`), `apply.ts`, `types.ts`, drivers (`listDirs`) | |
| `content/packs/core/scenarios/*/definition.json` | | new fields | |
| `content/packs/core/scripts/` | `index.ts`, `wakanda-forever.ts` | `scenarios/ultron.ts`, `scenarios/klaw.ts` (proposed), `index.ts` | |
| `src/engine/specials/`, `src/engine/boot.ts` | delete `wakanda-forever.ts`, drop import | | |
| `tools/generate-pack-hooks.ts`, `package.json`, `tsconfig.json`, `knip.json`, `scripts/pack-validate.ts` | new / edits | | |
| `src/engine/state/game-setup.ts`, `pipeline/scenario-helpers.ts`, `simulation/*`, `scripts/simulate-games.ts`, `ScenarioSelector.tsx`, `engine/decks/deck-utils.ts` | | | edits |
| `docs/guidelines/scenario_creation_guide.md` and the hero guide | hook notes | "how a scenario script works" (Ultron) | |
| `changes/unreleased/` | fragment | fragment | fragment |

## 7. Tests

- **Characterization first (start of M5b, before any refactor):** `tests/engine/scenario-setup-digests.test.ts` runs `onGameSetup` for Rhino, Klaw and Ultron (1 and 2 players, Standard and Expert, fixed seed) and compares a digest of the resulting state with golden values recorded from current `main`. These guard every later change.
- `tests/engine/scenario-scripts.test.ts`: Klaw's (proposed) and Ultron's scripts keep their behavior (side scheme from the deck or created, no-minion case, drones per player, zero players).
- `tests/data/scenario-definition.test.ts`: the new optional fields.
- `tests/data/content-loader.test.ts`: scenarios loaded and validated, bad definition disables its pack, duplicate scenario id.
- `tests/data/pack-hooks-generated.test.ts`: the checked-in map equals the generator output; `pack-validate` test: scripts without a map entry fail.
- `tests/data/content-apply.test.ts`: scenarios and hook handlers registered and cleared by `applyContent`/`resetContent`.
- M5c: `defaultScenarioId()` ordering and zero-scenario error; the zero-pack smoke test renders with no selection.

## 8. Verification (once per PR, after the last edit)

`tsc`, lint, format, `docs:check`, `deadcode`, `pack:validate -- content/packs`, the full `npm test`, and `npm run simulate` compared byte for byte with a clean `main` run (card data hash `362be14e`, 185 abilities, 20 Gauntlet matches). Browser check of the dev app for M5b and M5c (scenario selector lists Rhino, Klaw and Ultron, a game starts for each). `npm run simulate -- --balance` cannot be compared until #534 is fixed.

## 9. Debt Removed

- Three scenario classes (subclassing for two hooks) and a Drone literal built inside engine code.
- Hard-coded Core card codes in the engine (`01094`, `01097b`, `01124`, `01140`, the Black Panther code list).
- About a dozen `'rhino'` defaults that made the engine unable to start without Rhino.
- Side-effect registration at import time (scenarios and the special handler), which is the last thing that kept content out of the runtime loader.

## 10. UI and Card Editor impact

The scenario selector reads the same registry and shows the same three scenarios in the same order; it starts with no selection when there are none (the polished empty state is M7). No Card Editor change. The creator-facing scenario guide gains a worked example of a scenario script (Ultron), next to the card script example (Wakanda Forever).

## 11. Decisions and open points

Decided (2026-11-01):

1. **Uniqueness decides where code lives.** One-off scenario and card logic is a pack script (Ultron, Wakanda Forever); only generic behavior is engine code, and anything the existing effect primitives already express stays data. Klaw was checked and does not qualify yet; whether it is a script until #275 is decided in the Klaw review. Ultron is the reference example of a scenario script. No declarative setup-step vocabulary is added. (Replaces the earlier proposal of four setup steps.)

Open, each with a recommendation:

2. **What may official hook scripts import?** **Recommend any `@engine` module**, because they are bundled at build time and trusted (Q16); a stricter barrel can come with the sandbox ADR.
3. **Default scenario.** **Recommend the lowest `scenarioCardCode` among registered scenarios** (Rhino today), with a clear error when none is registered, so `setupGame` keeps working in tests without naming a scenario.
4. **`'core'` literals** (`deck-utils.ts`, `simulation/*`, listed in the coupling audit as an M3 item that M3 did not cover). **Recommend M5c:** the prebuilt deck file name takes the deck's pack code, and the simulation and coverage scope default to the enabled packs from the loaded content instead of the literal `'core'`.
5. **PR split.** **Recommend three PRs** (section 5), so each parity gate isolates one risk.

## 12. Done when

No file under `src/engine` names a Core card code or `'rhino'`, `built-in/` and `specials/wakanda-forever.ts` are gone, scenarios and hooks register through the loader, the zero-pack boot still works, and the setup digests and `npm run simulate` output match `main` byte for byte.
