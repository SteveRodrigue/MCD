# Plan: Remediate code audit AUD-20261017-232534

> **Status:** Approved by the owner on 2026-10-17 (execution order, one commit per finding, no push without request). In progress.
> **Source report:** `logs/reports/code-audit/2026-10-17T23-25-34Z_full_repository.md` (gitignored, local only). This plan is the tracked copy of the findings that are being fixed; it carries the evidence needed to work without the report.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).
> **Stop rule:** stop and ask the owner only for a rules ambiguity (confidence below 95 %) or a Tier 3 change (core state model, public contract, phase architecture, structural migration).

Each finding below has the AGENTS.md plan sections: rules/spec analysis, Simplification & Refactor Check, file changes, tests, open decisions, UI and Card Editor impact. Findings are delivered in this order, one Conventional Commit each. Delete this file in the commit that delivers the last item.

| #   | Finding                                          | Tier | Gate 1       |
| --- | ------------------------------------------------ | ---- | ------------ |
| 1   | F001 simulator turn loop                         | 2    | 🔴 blocker   |
| 2   | F002 single playability core (parity test first) | 2    | 🟠           |
| 3   | F003 single end-of-player-phase step             | 2    | 🟠           |
| 4   | F004 delete the legacy scenario catalog          | 2    | 🟠           |
| 5   | F006 gate the per-action snapshot logger         | 1    | 🟠           |
| 6   | F007 Rhino UI smoke suite + coverage include     | 1    | 🟠           |
| 7   | F010-C fail-fast `executeStep` default           | 2    | 🟠           |
| 8   | F011-B Rhino plugin reads its definition         | 2    | 🟠           |
| 9   | F018 unused dependencies and fonts               | 1    | 🟠           |
| 10  | F009 `appendLog` and deterministic ids           | 2    | 🟠           |
| 11  | F005-A share card definitions across clones      | 2    | 🟠           |
| 12+ | Post-Rhino items (section "Post-Rhino")          | 1–3  | ⚪ Tech Debt |

---

## 1. F001: the headless simulator never ends a player turn

**Rules/spec analysis.** Gate 1 §1.4 requires a 100-game headless simulation. RR v1.8 "End of Player Phase" (`references/rules/glossary/E.md`): after every player's turn, players discard, draw up to hand size and ready; then the villain phase runs. In the engine this sequence starts only from `END_PLAYER_TURN` (`action-dispatcher.ts`, `initiatePlayerPhaseCleanup`). `runMatch` (`src/engine/simulation/match-simulator.ts:198-248`) `break`s when the bot returns `END_PLAYER_TURN` without dispatching it, then calls `executeVillainPhase` itself. Heroes never draw or ready after round 1. Last 100-game summary: 0/100 hero wins, 3.3 rounds, 7.6 actions per game. The test only asserts `winner ∈ {HEROES, VILLAIN, TIMEOUT}`.

**Simplification & Refactor Check.**

- Delete the hand-written phase loop in `runMatch`: the manual `state.phase = PLAYER_PHASE`, the manual `phase.player_phase.start` log push (a mutation of a dispatched state), the per-player index loop, and the direct `executeVillainPhase` call.
- Replace with one loop: ask the bot for the active player's action, dispatch it (including `END_PLAYER_TURN`), drain prompts with the existing heuristic, repeat until `winner` or `roundNumber > maxRounds`. The engine drives cleanup → villain phase → round upkeep → next player phase.
- The dispatcher path calls `executeVillainPhase` without the simulator's `AUTO_OPTIMAL` combat policy, so defence prompts appear as in a real game and the existing prompt heuristic resolves them.
- `maxActionsPerTurn` stays: when reached, the simulator dispatches `END_PLAYER_TURN` itself. When the bot picks an illegal action, it also ends the turn through `END_PLAYER_TURN` (no silent `break`).

**File changes.**

- `[MODIFY] src/engine/simulation/match-simulator.ts`: single dispatch-driven loop as above; `assertGameStateInvariants` once per round (on `roundNumber` change) and at the end.
- `[MODIFY] tests/engine/match-simulator.test.ts`: falsifiable assertions.
- `[MODIFY] scripts/simulate-games.ts` only if its result handling depends on removed fields (no field is removed).
- `[NEW] changes/unreleased/2026-10-17-simulator-turn-loop.md`.

**Tests (written first).**

- 1P Spider-Man vs Rhino Standard, fixed seed: at the start of round 2 the hand size equals the effective hand size, and the identity is ready.
- Same game: `totalActionsExecuted` above the old 7.6 average floor (assert ≥ 10 over 5 rounds with `maxRounds: 5`, deterministic seed).
- The 5-hero battery keeps running; it also asserts `roundsPlayed ≥ 2` unless a winner exists.
- Acceptance run: `rtk npm run simulate` regenerates `logs/simulations/simulation_summary.md` (local only; numbers reported in the commit recap).

**Open decisions.** None. If the bot surfaces a stuck prompt, that is an engine or bot bug found by the gate; it is fixed in scope if it is in the bot or the prompt heuristic, otherwise filed.

**UI and Card Editor impact.** No change required: the simulator is headless (`src/engine/simulation/`), used by `scripts/simulate-games.ts` and tests only.

---

## 2. F002: two card-playability evaluators

**Rules/spec analysis.** RR v1.8 "Play" / "Player Turn" / "Max" / "Unique" / "Restricted" / "Ally limit" rules are checked twice in `src/engine/pipeline/legality-checker.ts`: `canPlayCard` (dispatcher, first failing reason) and `evaluateCardPlayability` (UI hand tray, legal-actions generator, bot; all reasons + `maxPotentialResources`). A byte-identical `getControlledCount` block exists in both. Drift already found while planning: `evaluateCardPlayability` does not check an event's declared extra cost (`getEventAbilityExtraCost` + `canPayAbilityCost`), so the hand can show an event as playable that the engine then rejects. Reason strings also differ in wording.

**Simplification & Refactor Check.**

- Step C (parity test) first: for each Core starter deck, put each deck card in hand with enough other cards to pay, and assert `canPlayCard(...).allowed === evaluateCardPlayability(...).isPlayable` in hero and alter-ego form. It must fail on the extra-cost drift before the refactor.
- Step A: extract `collectPlayRestrictions(state, player, cardInstance, { targetPlayerId?, targetInstanceId? }): string[]` holding every rule check once (play requirements, target requirements, turn/phase, ambiguity block, reactive event, resource card, ally limit, restricted limit, max per player incl. `playUnderAnyPlayerControl`, unicity, event extra cost). One message wording per rule.
- `canPlayCard` = source-zone lookup + `collectPlayRestrictions(...)[0]` + payment validation. `evaluateCardPlayability` = `collectPlayRestrictions(...)` + affordability.
- Merge the duplicated resource math: one `getHandCardResourceValue(paymentCard, playedCard)` (aspect doubling) and one `getGeneratorYield(state, player, instance)` returning `{ amount } | { error }`, used by payment validation (error = reject) and by the max-potential sum (error = skip).

**File changes.**

- `[MODIFY] src/engine/pipeline/legality-checker.ts`.
- `[MODIFY]` tests that assert a reworded reason string (found with `rg` on the old strings).
- `[NEW] tests/engine/playability-parity.test.ts`.
- `[NEW] changes/unreleased/2026-10-17-single-playability-core.md` (`Fixed`: hand shows events with an unpayable extra cost as unplayable).

**Tests.** Parity test (above, red before A, green after); `rtk npx vitest related src/engine/pipeline/legality-checker.ts --run`.

**Open decisions.** None (return shapes of both public functions stay the same).

**UI and Card Editor impact.** `PlayerHandTray` and the board legal-action list read `evaluateCardPlayability`; they get the same shape and now the extra-cost reason. No component change. Card Editor: none.

---

## 3. F003: `PLAYER_PHASE_ENDED` never fires; PHASE expiry copied 5 times

**Rules/spec analysis.** RR v1.8 "End of Player Phase" (`references/rules/glossary/E.md`), steps in order: 1 discard, 2 draw, 3 ready, 4 effects lasting "until the end of the phase" end, 5 resolve "when/after the player phase ends". Cross-checked with "Player Phase" (`P.md`) and "Lasting Effects". The engine runs 1–3 in `player-phase-cleanup.ts`, then calls `executeVillainPhase`. `endPlayerPhase` (the only dispatcher of `PLAYER_PHASE_ENDED`) is reached only by tests. The "expire PHASE effects" block exists in `startPlayerPhase`, `endPlayerPhase`, `advanceVillainPhaseStep` (case 0), `executeVillainPhase`, and with ROUND in `step6_endVillainPhaseAndRound`; the `executeVillainPhase` copy has already drifted (it does not expire trait modifiers). Rules confidence: 100 % (glossary text is explicit).

**Simplification & Refactor Check.**

- One helper `expireLastingEffects(players, durations)` (cost reductions + recomputed `costReductions`, stat modifiers on player and controlled cards, trait modifiers, `thwBonus`/`atkBonus` tokens for PHASE/ROUND). Used by `endPlayerPhase` (PHASE), `step6` (PHASE + ROUND), and `END_PLAYER_TURN` (TURN, current player).
- `endPlayerPhase(state)` becomes the single production step 4–5: expire PHASE effects, reset `usedAbilitiesThisPhase`, log, dispatch `PLAYER_PHASE_ENDED`, set `VILLAIN_PHASE`.
- Both villain-phase runners call `endPlayerPhase` when entered from the player phase, instead of their own copies. This keeps the order cleanup → end of phase → villain phase, and covers every caller (cleanup, `ADVANCE_VILLAIN_PHASE`, tests).
- Delete the copy in `startPlayerPhase` (PHASE effects already ended at step 6). Delete `passActivePlayer` (test-only; `END_PLAYER_TURN` is the production path).

**File changes.**

- `[MODIFY] src/engine/pipeline/player-phase.ts`, `villain-phase.ts`, `round-upkeep.ts`, `action-dispatcher.ts` (TURN expiry via helper).
- `[MODIFY] tests/engine/lifecycle-triggers.test.ts` (re-point the `passActivePlayer` test to `dispatchAction(END_PLAYER_TURN)`).
- `[NEW]` test: `PLAYER_PHASE_ENDED` fires once per player per round through `dispatchAction(END_PLAYER_TURN)` + cleanup, after the draw.
- `[NEW] changes/unreleased/2026-10-17-player-phase-ended.md`.

**Tests.** New dispatch-driven trigger test (red first); `rtk npx vitest related src/engine/pipeline/player-phase.ts src/engine/pipeline/villain-phase.ts --run`.

**Open decisions.** None.

**UI and Card Editor impact.** No change required: `PLAYER_PHASE_ENDED` is already a schema trigger offered by the editor; it now fires in real games. No card uses it today.

---

## 4. F004: legacy scenario catalog in the setup flow

**Rules/spec analysis.** Scenario setup (RR v1.8 Appendix "Setup") is owned by `ScenarioRegistry` + `definition.json` + the plugin's `onGameSetup`. The UI also runs the legacy `src/engine/scenarios/catalog.ts`: `App.tsx` builds villain/scheme/deck with `createEncounterDeck`, mutates `villain.health` on a shared catalog object for Expert, and passes them to `setupGame`, where the plugin overwrites all of it. `ScenarioSelector` lists scenarios and modular sets from hard-coded data, and the counts have drifted (Under Attack says 8 cards; the data has 5). Three `CardCatalog` instances parse the same JSON.

**Simplification & Refactor Check.**

- Delete `catalog.ts` and its re-exports (`getScenario`, `listScenarios`, `scenarioCatalog`, `listModularEncounterSets`, `MODULAR_ENCOUNTER_SETS`, `LegacyScenarioDefinition`).
- `ScenarioSelector` lists `ScenarioRegistry.getAll().map(p => p.definition)`. Display data: name and description from `definition.json`; subtitle = main scheme stage 1A card name (catalog); villain preview = `villainSetup.stages[difficulty][0]`; recommended modular set = `modularEncounterSets.recommendedModularSets[0]` (field already in the type, added to the three `definition.json` files).
- Modular sets: one data file `src/engine/scenarios/modular-sets.json` (code, name, description; the names are not in the upstream data), card counts derived from the catalog.
- `App.tsx` calls `setupGame({ scenarioId, difficulty, heroicLevel, modularSetCodes, players })` only, and uses the `cardCatalog` singleton. `ScenarioSelector` drops its own catalog fallback.
- `setupGame` keeps its `villain`/`mainScheme`/`encounterCards` options only if a non-plugin caller still uses them (checked with `rg`; removed otherwise).

**File changes.** `[DELETE] src/engine/scenarios/catalog.ts`; `[MODIFY] src/engine/scenarios/index.ts`, `types.ts`, `built-in/*/definition.json`; `[NEW] src/engine/scenarios/modular-sets.json` (+ a typed accessor in `index.ts`); `[MODIFY] src/ui/App.tsx`, `src/ui/components/setup/ScenarioSelector.tsx`; tests that import the removed exports; changelog fragment.

**Tests.** UI test: `ScenarioSelector` lists Rhino/Klaw/Ultron from the registry, shows "The Break-In!" and the Bomb Scare count from the catalog; starting Rhino Expert yields Rhino II with its own HP and no mutation of the catalog card (covered with F007's App test if that file lands first; otherwise here).

**Open decisions.** None.

**UI and Card Editor impact.** Scenario selection screen: same layout and fields; modular set counts become correct; scenario subtitles come from card names. Card Editor: none.

---

## 5. F006: per-action state snapshot in every build

**Rules/spec analysis.** Not a gameplay rule. `App.tsx` calls `logGameStateSnapshot` on every state change; it serialises the whole state twice (sessionStorage + POST body) and POSTs to a dev-only endpoint, also in production builds. The snapshot feature exists for problem-report triage.

**Simplification & Refactor Check.**

- Gate: snapshot only when `import.meta.env.DEV && settings.devMode`, scheduled with `requestIdleCallback` (fallback `setTimeout`), cancelling the previous pending snapshot.
- Remove the sessionStorage copy and `getLatestGameStateSnapshot`: it becomes stale once snapshots are gated. `ReportProblemModal` takes the live state from its prop or from `GameStateContext` (the card context menu path has no prop today).
- `vite.config.ts` snapshot plugin unchanged (dev server only; volume now bounded by Dev Mode + idle scheduling).

**File changes.** `[MODIFY] src/ui/App.tsx`, `src/ui/services/gamestate-logger-service.ts`, `src/ui/components/board/ReportProblemModal.tsx`; `[MODIFY] tests/ui/problem-report-service.test.ts`, `tests/ui/gamestate-logger-service.test.ts`; changelog fragment.

**Tests.** Logger test: no sessionStorage write; ReportProblemModal reads the context state when no prop is given.

**Open decisions.** None.

**UI and Card Editor impact.** Rolling snapshots in `logs/gamestates/` are written only with Dev Mode on, in the dev server. Report a Problem keeps embedding the live state.

---

## 6. F007: Rhino release UI paths without tests; coverage blind spot

**Rules/spec analysis.** Gate 1 is a UI release; no test imports `App.tsx`, `ScenarioSelector`, `MulliganScreen` or `WakandaForeverModal`. `vitest.config.ts` has no `coverage.include`, so never-imported files are missing from the report.

**Simplification & Refactor Check.** One smoke test file parameterised with `it.each` over the 5 Core heroes (no copy-paste per hero). Reuse `tests/ui/setup/offline-dev-api.ts`.

**File changes.** `[NEW] tests/ui/rhino-release-smoke.test.tsx` (selector → Standard/Expert → mulligan → board renders → end turn), `[NEW] tests/ui/wakanda-forever-modal.test.tsx`; `[MODIFY] vitest.config.ts` (`coverage.include: ['src/**/*.{ts,tsx}']`); changelog fragment.

**Tests.** The new files themselves; `rtk npm run test:coverage` once to confirm App/ScenarioSelector/MulliganScreen appear.

**Open decisions.** No per-folder thresholds yet (ratchet values need one baseline run; proposed in the commit recap).

**UI and Card Editor impact.** Tests only.

---

## 7. F010-C: `executeStep` silently succeeds on unknown effects

**Rules/spec analysis.** Not a rule. `executeStep` (`src/engine/effects/index.ts`) `default:` returns `{ success: true }`, so an effect without a handler resolves as a no-op. The constant effects evaluated elsewhere (`CANNOT_TAKE_DAMAGE`, `DOUBLE_RESOURCE_FOR_ASPECT`, `MODIFY_HAND_SIZE`, `MODIFY_MAX_HEALTH`) fall into it today. `case 'END_TURN' as any` in the dispatcher has no producer.

**Simplification & Refactor Check.** Add explicit no-op cases for the constant effects (grouped with the existing `MODIFY_*_LIMIT` no-ops); `default` throws with the effect name (and is exhaustive at compile time when `step.effect` is the schema union). Delete the `'END_TURN' as any` case.

**File changes.** `[MODIFY] src/engine/effects/index.ts`, `src/engine/pipeline/action-dispatcher.ts`; `[MODIFY] tests/ui/gamestate-logger-service.test.ts` only if it relies on `END_TURN` (it passes it as an opaque label; no change expected); changelog fragment.

**Tests.** New test: an unknown effect throws; a constant effect step resolves as a no-op.

**Open decisions.** None.

**UI and Card Editor impact.** None.

---

## 8. F011-B: Rhino plugin duplicates its definition

**Rules/spec analysis.** Rhino stage progression (Standard I→II, Expert II→III, Skirmish I only) is in `rhino/definition.json` and also hard-coded in `rhino/plugin.ts` (`'01094'`…`'01097b'`). `evaluateWinLossConditions` and the `onVillainPhaseStep1/2` hooks are never invoked.

**Simplification & Refactor Check.** `onVillainDefeated` reads the next stage from `definition.villainSetup.stages[difficulty]` (no next stage = victory); the encounter-deck filter excludes the definition's villain and main-scheme codes. Delete `evaluateWinLossConditions` (Rhino + interface) and `onVillainPhaseStep1/2` (interface). Klaw/Ultron clones stay until F011-A (Gate 2).

**File changes.** `[MODIFY] src/engine/scenarios/built-in/rhino/plugin.ts`, `src/engine/scenarios/types.ts`; tests referencing removed members; changelog fragment.

**Tests.** Existing Rhino stage tests; add Skirmish and Expert stage-advance assertions if missing.

**Open decisions.** None.

**UI and Card Editor impact.** None.

---

## 9. F018: unused dependencies and shipped assets

**Rules/spec analysis.** Not a rule. `zustand`, `clsx`, `tailwind-merge`, `@typopro/dtp-komika-text` have 0 imports; 6 Komika TTFs (`Kaps*`, `Tight*`) are unused by `index.css`; `framer-motion` is used once (`editor/CollapsibleSection.tsx`).

**Simplification & Refactor Check.** Remove the 4 dependencies and 6 fonts; replace `framer-motion` with a CSS grid-rows height transition in `CollapsibleSection`.

**File changes.** `[MODIFY] package.json`, `package-lock.json`; `[DELETE] public/fonts/TypoPRO-KomikaText-{Kaps,KapsBold,KapsBoldItalic,KapsItalic,Tight,TightItalic}.ttf`; `[MODIFY] src/ui/components/editor/CollapsibleSection.tsx`; changelog fragment.

**Tests.** `tests/ui/collapsible-section.test.tsx`; `rtk npm run build` once (bundle check).

**Open decisions.** None (F012-B, which could use zustand, is not adopted).

**UI and Card Editor impact.** Card Editor collapsible sections animate with CSS instead of framer-motion; same open/closed behaviour.

---

## 10. F009: log boilerplate and `Date.now()` in the engine

**Rules/spec analysis.** ADR-0081 (deterministic simulation) and ADR-0002. About 200 hand-written `state.log.push({ id: \`log_${Date.now()}\`, timestamp: Date.now(), round, phase, … })`sites; instance ids built from`Date.now()` (`rhino/plugin.ts`, `game-setup.ts`, `advance-villain-stage.ts`, others). Two runs with the same seed produce different states.

**Simplification & Refactor Check.** One `appendLog(state, entry)` helper: id from `nextEngineId(state, 'log')`, round and phase filled from state when omitted, timestamp from a deterministic source. Codemod every `log.push` site in `src/engine`. Replace `Date.now()` in instance and prompt ids with `nextEngineId`.

**File changes.** `[NEW]` `appendLog` in the engine state module next to `nextEngineId`; `[MODIFY]` the ~23 engine files; changelog fragment.

**Tests.** New determinism test: two `runMatch` runs with the same seed produce `JSON.stringify`-equal final states. `rtk npx vitest related` on the changed files.

**Open decisions.** Timestamp source: if the deterministic option needs a new `GameState` field or removal of `GameLogEntry.timestamp`, that is a state-model change (Tier 3) and goes to the owner first.

**UI and Card Editor impact.** The comic log keys and params are unchanged; the log id format changes (UI uses ids only as React keys).

---

## 11. F005-A: share immutable card definitions across state clones

**Rules/spec analysis.** Not a rule. `cloneGameState` is `JSON.parse(JSON.stringify(state))`; 83–85 % of the bytes are static card definitions copied into every `CardInstance.card`. No source code mutates `inst.card.*` (search `\.card\.\w+\s*=` → 0 hits in `src`).

**Simplification & Refactor Check.** One `cloneGameState` rewrite: a recursive clone with JSON semantics (drops functions and `undefined` keys, `undefined` array items become `null`) that keeps catalog card definitions by reference. Catalog cards are registered in a `WeakSet` by `CardCatalog` and frozen in test runs to catch mutations. No API change.

**File changes.** `[MODIFY] src/engine/models/state.ts`, `src/data/importer/card-loader.ts`; tests that mutate catalog cards are fixed to clone first; changelog fragment.

**Tests.** Clone test: card definitions shared by reference, game data deep-copied, functions dropped; measurement with the audit's `measure-state.ts` before/after in the recap.

**Open decisions.** None.

**UI and Card Editor impact.** None (card objects in state are the same values).

---

## Post-Rhino (Tech Debt & Tooling), report §9 order

Detailed plans are written into this section before each item starts. Tier 3 items stop for the owner.

| Order | Finding                                                                         | Tier | Note                                                              |
| ----- | ------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| 12    | F008 typed card filter; fix `isIdentitySpecific`                                | 2    | Latent bug: matches almost every Core card                        |
| 13    | F016 remove deprecated `state.villain` / `mainScheme` (#215)                    | 3    | **Owner approval required** (state model)                         |
| 14    | F017 delete unused exports and alias wrappers                                   | 1    |                                                                   |
| 15    | F013 shared test fixtures                                                       | 1    | After F016                                                        |
| 16    | F012 `GameSessionContext`, playability computed once                            | 2    |                                                                   |
| 17    | F014-A Zod-free runtime module                                                  | 2    |                                                                   |
| 18    | F010-A / F014-B,C handler registries, catalog injection                         | 2–3  | F014-B (catalog injection) is Tier 3: **owner approval required** |
| 19    | F011-A declarative scenario plugin                                              | 2    | Gate 2 scope (Klaw/Ultron re-verification)                        |
| 20    | F015 enums, F019 dev-server middleware, F020 UI hygiene, F021 lint/docs hygiene | 1–2  | F019 path traversal goes through `security-review`                |

---

## 12. F008: typed card filter (detail)

**Rules/spec analysis.** `docs/specifications/supplemental/04_universal_card_filter.md`: `isIdentitySpecific` is "cards belonging to the active player's identity set"; `PLAYER_NEMESIS` is "the resolving hero's nemesis set" (used only by Shadow of the Past 01190, "your set-aside nemesis", confidence 100 %); `isExhausted` and `hasStatus` read the card in play. The old evaluator read upstream fields that do not exist (`card_set_code`, `set_type`, `raw.keywords`), so `isIdentitySpecific` matched almost every Core card by code prefix, and `isExhausted`/`hasStatus` read instance state from the card definition, where it never is.

**Simplification & Refactor Check.** Rewrite `matchesCardFilter` on normalized fields only (`type`, `faction`, `setCode`, `belongsToHeroSet`, `keywords` via `hasKeyword`); delete every alias key branch (`type`, `trait`, `set`, `targetCardCode`, ...), which the strict schema already rejects. The subject is a card or a card in play (`{ card, exhausted, statusCards }`), so callers pass the instance they hold. Delete the `matchCardFilter` alias. Replace the `raw.keywords` Piercing/Overkill probes with `hasKeyword` and drop the dead `raw.restricted` probe.

**File changes.** `src/engine/filters/card-filter.ts`; callers in `effects/index.ts`, `dynamic-formula-evaluator.ts`, `trigger-dispatcher.ts`, `attachment-host.ts`, `cost-engine.ts`, `legality-checker.ts`, `CardPaymentModal.tsx`; `card-loader.ts`; tests that used alias keys.

**Tests.** Filter tests for identity (Spider-Man vs She-Hulk card), `PLAYER_NEMESIS`, exact set match, in-play criteria on a definition; full suite.

**Open decisions.** None. **UI and Card Editor impact.** None: the editor already writes only canonical keys.

---

## 16. F012: UI re-render cost (detail)

**Rules/spec analysis.** Not a rule. `PlayerHandTray` evaluated every hand card's playability in three places per render; `App.tsx` copied the "apply UI settings to `state.options`" block at five dispatch sites plus a sync effect.

**Simplification & Refactor Check.** The tray computes one playability map per hand and state (`useMemo`) used by the click guard, the end-turn pulse and the fan. `App` gets one `withUiOptions(state)` helper for every new state. **Not done:** moving `gameState`/`onDispatchAction` from props to a context. Memoised children only pay off once state objects keep their identity between actions (structural sharing, audit F012-B / Appendix A1), and the switch rewrites the props of six components and their tests. Revisit with a React Profiler capture.

**File changes.** `src/ui/components/board/PlayerHandTray.tsx`, `src/ui/App.tsx`. **Tests.** Existing tray, App smoke and related UI tests (behaviour unchanged). **Open decisions.** None. **UI impact.** None visible.

---

## 20. Hygiene items (detail)

- **F015** delivered: `CardTypeSchema` and `ResourceTypeSchema` take the engine enum values (`player_side_scheme` was missing). `AspectSchema` stays a deliberate subset of `FactionCode`.
- **F019** delivered: shared `readJsonBody`/`sendJson`/`handleJsonPost`/`downloadFile` in `vite.config.ts` (566 → 353 lines); write endpoints (snapshots, reports, stats, Card Editor) run on the dev server only, not on `vite preview`; Card Editor pack file names must be a bare `<name>.json` (a `../` path could write outside the pack folder). **Not moved:** the Event `discardSelf` check needs the card's upstream type, which `CardEnrichmentSchema` cannot see, so it stays in the editor middleware.
- **F020** delivered: `useTimeout` and `useOptionalGameSettings`.
- **F021** delivered: lint covers `tests/`, `tools/`, `scripts/`; `ENGINE_VERSION` from `package.json`; root plan deleted. `no-explicit-any` stays off: as `warn` it would fail `--max-warnings 0` on the 452 existing `any`.

---

## 18–19. Handler registry, import cycles, declarative scenarios (detail)

Owner approved both rows on 2026-10-18.

- **F010-A** delivered: `executeStep` dispatches through `EFFECT_HANDLERS` (seven family modules, compile-time complete), ADR-0085. Not done: typing `effectParams` per effect from `effect-params.ts`.
- **F014-C** not delivered, needs an owner design decision. The engine has one import cycle of 30 modules (effects, handlers, triggers, pipeline, scenarios, specials) because the rules recurse: triggers execute effects, effects dispatch triggers, pipeline steps call both. Moving shared helpers to leaf modules does not remove it. Removing the load-time `registerFinishDamagePlacementsHook` changed module load order and made 18 tests that mock `trigger-dispatcher` with `importOriginal` bind the real module; reverted. A real fix is an engine "kernel" that wires the trigger dispatcher, effect executor and pipeline at boot (dependency injection), which changes how every engine module is reached (Tier 3).
- **F011-A** delivered: `DeclarativeScenarioPlugin` drives Rhino, Klaw and Ultron from `definition.json` (plugins 919 → 456 lines, behaviour unchanged, all scenario tests green). Left in code for Gate 2 card integration: Klaw's Defense Network setup and Klaw II's Immortal Klaw attach, Ultron's drones. **Rules question for Gate 2:** Klaw Expert starts on Klaw II, but Klaw II's reveal (attach The "Immortal" Klaw) runs only when Klaw I advances, not at Expert setup, unlike Rhino II whose reveal runs at Expert setup. Confidence below 95 % without reading the card text; not changed.
