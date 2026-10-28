# Plan: #431 Automated Card-Ability & Combo Coverage Simulation (Gate 1, roadmap 1.4)

**Status:** Draft, waiting for owner approval. No code changed.
**Issue:** [#431](https://github.com/SteveRodrigue/MCD/issues/431), Gate 1, P0 (Release Gate 1.4).
**Reviewer checklist:** [review_issue_431_card_ability_simulation.md](review_issue_431_card_ability_simulation.md).
**Blast-Radius Tier:** Tier 2 (simulation harness, bot policy, verification suite, and state validator invariants; no gameplay rules or UI changes).
**UI / Card Editor impact:** None (`src/engine/simulation/`, `src/engine/state/state-validator.ts`, `scripts/simulate-games.ts`, and `tests/engine/` only).
**Delivery:** Two phases under one issue, each its own pull request (see §6).
**Estimate:** about 1 day per phase. Phase 1: verifier, coverage ledger, stage-setter, CLI, CI test. Phase 2: scarcity bot, matchmaker, prompt rotation, stats merge.

---

## 1. Owner Decisions Locked In (`/grill-me` + plan review)

1. **Architecture — Hybrid "Stage-Setter (gate) + Gauntlet (exploration)":**
   - **Stage-Setter (the CI gate):** A deterministic, legality-driven state-sculptor exercises every Core Set ability through the real engine pipeline. It is the only half that decides pass/fail.
   - **Gauntlet (exploratory):** Full headless matches with a scarcity- and combo-aware bot trigger abilities and multi-card interactions naturally. It reports extra coverage, crashes, and combo findings, but never gates CI, because its result depends on seeded bot behavior.
2. **Verification Depth — Crash + Invariant + Registered Effect-Delta Check:**
   Every ability resolution verifies: (a) zero `engine.stepError` entries in `state.log`, (b) zero stuck prompts or dangling `pendingSequences` after `drainPrompts`, (c) `assertGameStateInvariants(state)` (including the new invariants in §4.6), (d) `state.stats.cards[cardCode].abilitiesUsed[abilityId]` increments for use-event timings, and (e) every executed step produced the delta its effect primitive declares in the **Effect-Delta Registry** (§4.4).
3. **"Covered" is defined per timing (§4.1).** Not every ability has a use event (22 `CONSTANT`, plus `RESOURCE`, `SETUP`, `SPECIAL`), so each timing class has an explicit observable.
4. **Fail on unsupported ability.** The inventory is auto-built from card data. An ability the Stage-Setter cannot drive fails the gate with a named reason (card, ability, unmet precondition). There is no allowlist.
5. **Stats-Driven Prioritization (Phase 2, `stats/card_play_stats.json`):**
   - The Gauntlet reads [card_play_stats.json](../../stats/card_play_stats.json) as its baseline scarcity ledger (`scarcity = 1 / (1 + uses)`), drafts legal hero/aspect decks weighted toward under-played cards and combo pairs, and protects under-tested cards from being spent as resources.
   - `npm run simulate` writes its coverage report and replay catalog to `logs/simulations/` and merges back into [card_play_stats.json](../../stats/card_play_stats.json) only when `--update-stats` is passed, so automated runs never pollute live human stats.
6. **Combo Prerequisite Enabler & Branch-Rotating Prompt Resolver (Phase 2):** The bot performs enabling actions (form flips, safe undefended hits, setup pieces before payoffs), and the prompt resolver rotates across `PLAYER_CHOICE` / modal options so every choice branch is exercised.
7. **Unified `chooseBotAction` & Repurposed Roadmap 1.4 Gate:** Keep one `chooseBotAction` and `BOT_POLICY` in [player-bot.ts](../../src/engine/simulation/player-bot.ts). Roadmap 1.4 changes from a win-rate gate to a **100% Core Set Card-Ability Coverage & Zero-Error Gate**. Win rate by hero, aspect, and difficulty stays in `simulation_summary.md` as a **non-gating informational report**, labelled as non-representative play because the coverage bot deliberately takes damage and holds cards.
8. **Reproducibility:** Every tested match or combo yields a self-contained `SimulationRecipe` (§4.5) saved in `logs/simulations/replay_catalog.json` for `--replay <id>` and `--card <code>`.
9. **Follow-up (not in #431):** a new issue for rule-keyed coverage (every `references/rules/glossary` entry exercised by at least one scenario). Create it at delivery and link it from the PR.

---

## 2. Rules & Architectural Invariants

- **One Legality Gate ([legality-checker.ts](../../src/engine/pipeline/legality-checker.ts), ADR-0090):** Neither the bot nor the Stage-Setter bypasses `canPlayCard`, `canInitiateAbility`, `evaluateCardPlayability`, `checkAbilityTargets`, or [legal-actions-generator.ts](../../src/engine/pipeline/legal-actions-generator.ts). The Stage-Setter asks the gate why an action is illegal and repairs only that precondition; it never reimplements a legality rule. Every action goes through `dispatchAction` or canonical phase/combat entry points (`step4_revealEncounterCards`, `executeVillainAttackAgainstPlayer`).
- **Deterministic Replay (ADR-0081):** All shuffling, drafting, and prompt rotation use the seeded PRNG from [rng.ts](../../src/engine/state/rng.ts) (`createRng`, `randomInt(state, min, max)`, `shuffleArray`). The bot and the engine use separate RNG streams so a bot-policy tweak never shifts engine shuffles. No `Math.random` or `Date.now` in `src/engine/simulation/`.
- **Card-Agnostic Engine (ADR-0021):** Prerequisite detection, the Stage-Setter, and the Effect-Delta Registry inspect declarative `enrichment.abilities`, `playRequirements`, `cost`, `timing`, `trigger`, and `steps`, never hardcoded card names, and report coverage by `cardCode` and `abilityId`.

---

## 3. Simplification & Refactor Check

- **Extend [player-bot.ts](../../src/engine/simulation/player-bot.ts) in place (Phase 2):** Add optional `coverage?: CoverageLedger` to `BotDecisionContext` (currently only `{ state, playerId }`) and scarcity/prerequisite weights to `BOT_POLICY`. No second bot file or legacy policy toggle.
- **Reuse [legal-actions-generator.ts](../../src/engine/pipeline/legal-actions-generator.ts) for encounter/attachment actions (Phase 2):** `chooseAbility` currently scans only `activeFormCard` and `tableau` with `isFreeCost`. Extending it to paid abilities (reusing `choosePayment`) and `getLegalActionsForPlayer(state, player.id).villainActionItems` removes duplicate action discovery.
- **Parameterize `resolveDecisionPromptHeuristically` in [match-simulator.ts](../../src/engine/simulation/match-simulator.ts) (Phase 2):** Replace the in-order "first enabled option that dispatches" loop with a deterministic branch selector.
- **Reuse existing machinery, add nothing parallel:**
  - Replay checks extend [deterministic-simulation.test.ts](../../tests/engine/deterministic-simulation.test.ts) and the ADR-0081 replay test in [match-simulator.test.ts](../../tests/engine/match-simulator.test.ts).
  - The ledger reads `abilitiesUsed` already recorded by [stats.ts](../../src/engine/pipeline/stats.ts) and typed by `AllTimeStats` ([models/stats.ts](../../src/engine/models/stats.ts)).
  - The verifier calls `assertGameStateInvariants` ([state-validator.ts](../../src/engine/state/state-validator.ts)); new invariants live there, not in the simulator.
- **Replace [simulate-games.ts](../../scripts/simulate-games.ts) entirely:** it is a flag-less 100-game win-rate gate whose crash message mentions an unparsed `--seed`. The new script implements `--seed` (it feeds the `SimulationRecipe`) so that message becomes true.

### Debt Removed

1. **Free-cost-only ability restriction (`isFreeCost` in [player-bot.ts](../../src/engine/simulation/player-bot.ts)) (Phase 2):** Blocked the bot from ever activating paid `ACTION` abilities (`resourceCost`, `discardCard`, `spendCounters`, `damageSelf`, `heal`) or encounter `ACTION` abilities on attachments/schemes/obligations (*Armored Rhino Suit* `01098`, *Charge* `01099`, *Ivory Horn* `01100`, *Captain Marvel* `01010a`, *Focused Rage* `01027`, *Golden City* `01045`). Replaced with cost-aware ability selection and payment.
2. **In-order prompt option starvation ([match-simulator.ts](../../src/engine/simulation/match-simulator.ts)) (Phase 2):** `resolveDecisionPromptHeuristically` picks the first enabled option that dispatches successfully, permanently starving secondary `PLAYER_CHOICE` branches (e.g. *Nick Fury* `01084` options 2 and 3, *Vision* `01068`). Replaced with scarcity-aware branch rotation.
3. **Silent `engine.stepError` swallowing in `runMatch` (Phase 1):** `engine.stepError` is written by `src/engine/effects/index.ts` and declared in `log-events.ts`, but nothing consumes it. `runMatch` only checked `assertGameStateInvariants` at round and match end. It now collects and fails on any `engine.stepError` unless explicitly testing error logging.
4. **No parallel sculpting of legality rules (Phase 1):** The Stage-Setter repairs preconditions reported by the legality gate instead of encoding per-timing or per-card cost/target rules, so legality is never duplicated.
5. **Win-rate-only simulation gate (Phase 1):** The old gate could pass while whole abilities never ran. It is replaced by the coverage gate; win rate survives only as an informational report.

---

## 4. Detailed Design

### 4.1 Coverage Ledger (`src/engine/simulation/ability-coverage.ts`) — Phase 1

1. **Target Inventory (`buildCoreAbilityInventory`):** Queries [card-loader.ts](../../src/data/importer/card-loader.ts) (`cardCatalog.getAllCards()`) for cards in scope (`packCode === 'core'`, or a caller-supplied card/set filter) with `enrichment.abilities.length > 0`. At the time of writing that is **143 cards / 161 abilities** (the test asserts the live count, not a constant). Indexes every `(cardCode, abilityId)` plus `PLAYER_CHOICE` option branches in `step.effectParams.options`.
2. **Per-timing "covered" rule.** Timing counts below are the Core Set today:

   | Timing (count) | Covered when |
   | :--- | :--- |
   | `WHEN_REVEALED` (32), `BOOST` (6) | `abilitiesUsed[abilityId] >= 1` after the card is revealed / boosted through the real encounter path |
   | `HERO_ACTION` (25), `ALTER_EGO_ACTION` (6), `ACTION` (19) | `abilitiesUsed[abilityId] >= 1` after `USE_CARD_ABILITY` / `PLAY_CARD` in the matching form |
   | `RESPONSE` (13), `FORCED_RESPONSE` (14) | `abilitiesUsed >= 1` after the declared `trigger` event is dispatched |
   | `INTERRUPT` (5), `HERO_INTERRUPT` (4), `FORCED_INTERRUPT` (3) | `abilitiesUsed >= 1` after the declared `trigger` event reaches its interrupt window |
   | `CONSTANT` (22) | The ability's modifier/effect is observed in a before/after `StateDigest` while the source card is in play (not just "card in play") |
   | `RESOURCE` (6), `HERO_RESOURCE` (1) | A resource is generated or paid through the card in a real resource-payment step |
   | `SETUP` (1) | The effect is applied during `setupGame` |
   | `SPECIAL` (4) | Defined per ability in the Stage-Setter; each of the 4 is listed explicitly in the test with its observable |

   "Enters play" and "defeated" are **triggers** (`ENTERS_PLAY`, `DEFEATED`, `CHARACTER_DEFEATED`), not timings. `WHEN_PLAYED`, `SURGE`, and `WHEN_DEFEATED` do not occur as Core timings.
3. **Ledger API:** `untestedAbilities(): Array<{ cardCode; abilityId }>`, updated live. Scarcity (`cardScarcity = 1 / (1 + playedCount)`, `abilityScarcity = 1 / (1 + abilityCount)`) is used only by Phase 2 and is initialized from [card_play_stats.json](../../stats/card_play_stats.json) (zeroed in isolated tests).
4. **`SimulationRecipe` type** lives here (fields in §4.5).

### 4.2 Scarcity-Weighted Matchmaker & Combo Drafter (`src/engine/simulation/scarcity-matchmaker.ts`) — Phase 2

1. **Declarative Synergy Detection** from card schemas:
   - **Host / Upgrade / Support Payoffs:** steps referencing `CARDS_UNDER_HOST`, specific traits, or `MODIFY_STAT` / `READY` on allies.
   - **Discard / Zone Payoffs:** `PLAY_CARD_FROM_ZONE` or `RETURN_TO_HAND` from `PLAYER_DISCARD` paired with matching allies/upgrades.
   - **Status & Resource Payoffs:** `IF_ALREADY_HAS_STATUS`, `IF_RESOURCE_MATCH`, or `spendCounters` paired with status-inflicting and matching-resource cards.
   - **Trigger-window collisions (highest value):** group abilities by shared `trigger` (`DAMAGE_WOULD_BE_TAKEN`, `THREAT_WOULD_BE_PLACED`, `CHARACTER_DEFEATED`, `ENTERS_PLAY`, and so on) and draft decks that put two or more interrupts/responses on the same window, including forced-before-optional ordering. Bugs cluster there (Timing & Triggers cluster in `references/rules/TOPIC_MAP.md`).
2. **Deck & Scenario Assembly:** per match slot, pick the hero with the most untested identity abilities, the aspect with the highest summed `abilityScarcity`, and fill a legal 40-card deck (signature cards, `deck_limit`, unique rules) starting with highest-scarcity cards and their partners. Emit a `SimulationRecipe`.

### 4.3 Unified Explorer + Survival Bot (`src/engine/simulation/player-bot.ts`) — Phase 2

Extends `BOT_POLICY`, `chooseBotAction`, `chooseFormChange`, `chooseDefenderOption`, and `chooseAbility`, preserving all existing #309 unit-test behaviour when no `coverage` ledger is passed.

1. **Scarcity-aware play and payment:** `playValue` adds `untestedCardBonus` for 0-play cards or untested `ACTION` / `RESPONSE` / `INTERRUPT` abilities, scaled by `abilityScarcity`. `keepValue` adds `untestedKeepProtection` so `choosePayment` spends already-tested cards first. Exception: if the hand holds a discard-zone payoff and `player.discard` has no matching target, paying with a matching card is encouraged.
2. **Prerequisite and combo enabler:**
   - **Form flip:** to `ALTER_EGO` (when threat is not urgent) while holding or controlling an untested `ALTER_EGO_ACTION` or `playRequirements.identityForm === 'ALTER_EGO'`; to `HERO` for an untested `HERO_ACTION` / hero event.
   - **Safe damage for heal/pain abilities:** `chooseDefenderOption` takes a non-lethal attack undefended (`expectedHealthAfterHit >= 2`) when holding an untested ability that needs missing health (`HEAL_DAMAGE`, `cost.heal`, dynamic `DAMAGE_ON_SELF`).
   - **Setup before payoff:** hold payoff events whose steps check control/status filters until a matching target is in play.
3. **Paid and encounter `USE_CARD_ABILITY`:** `chooseAbility` evaluates identity, tableau, and `getLegalActionsForPlayer(...).villainActionItems`; costs are paid through `choosePayment` with `paymentCardInstanceIds` / `generatorInstanceIds`.
4. **Frozen ledger:** the bot reads the per-match ledger snapshot stored in the recipe, never the live ledger, so decisions replay identically.

### 4.4 Stage-Setter & Effect-Delta Registry (`ability-stage-setter.ts`, `effect-delta-verifier.ts`) — Phase 1

1. **Legality-driven Stage-Setter (`exerciseCardAbility(cardCode, abilityId, options)`):**
   - Start from a seeded `setupGame` state with a hero matching the card's `setCode`/aspect against Rhino.
   - Loop: ask the legality gate (`canInitiateAbility`, `evaluateCardPlayability`, `checkAbilityTargets`) why the action is illegal and repair exactly that precondition: wrong form (flip), missing resources or discard cost cards (add wild resources/cards), missing counters, missing health to pay (apply damage), missing target (spawn a minion, side scheme, ally, attachment, or place a matching card in the required zone). Repeat until legal, then fire through `dispatchAction`. A bounded iteration count with a named failure reason prevents loops.
   - **Trigger driver table** (small, keyed by the `trigger` value, only for trigger-timed abilities and encounter timings): `WHEN_REVEALED` / `BOOST` use `step4_revealEncounterCards` / the boost reveal during `executeVillainAttackAgainstPlayer`; `INTERRUPT` / `RESPONSE` / `FORCED_*` dispatch the exact triggering event (enemy attack, threat placement, basic attack/thwart, character/minion/scheme defeat, form flip, round end, entering play) and resolve the resulting prompt.
   - **Axes:** each encounter-facing ability runs for 1 and 2 players, and as hero and as alter-ego where the card's text or `playRequirements` cares. `PLAYER_CHOICE` branches run in separate seeded sub-runs so every option is exercised.
   - **Unsupported ability:** if no repair applies or the ability still cannot fire, fail with `{ cardCode, abilityId, unmetPrecondition }`.
2. **Trigger-window combo sweep:** for each trigger shared by two or more abilities, stage both in the same window and assert both resolve with correct ordering (forced before optional) and no `engine.stepError`.
3. **Effect-Delta Registry:** each effect primitive in `src/engine/effects/` declares its expected observable delta beside its handler (for example `DEAL_DAMAGE`: HP change by `amount` adjusted for prevention; threat placement: threat change; zone moves: zone membership). The verifier looks the contract up for every executed step. A unit test fails if any registered effect primitive lacks a contract. A step whose `gate` evaluated false may legitimately no-op. This replaces "at least one step produced some delta".
4. **Verifier (`verifyAbilityExecution`):** captures a `StateDigest` before and after and checks: no new `engine.stepError`; no unresolved prompts or pending sequences after `drainPrompts`; `assertGameStateInvariants` passes; `abilitiesUsed` increments where the timing requires; every executed step satisfied its registry contract.

### 4.5 Replay Catalog & CLI (`scripts/simulate-games.ts`) — Phase 1 (core), Phase 2 (Gauntlet, `--update-stats`)

`SimulationRecipe` fields: `seed`, `botSeed` (separate RNG stream), hero/deck card codes, scenario/modular sets, difficulty, player count, prompt-rotation seed, a frozen ledger snapshot, and a **card-data hash**. `--replay` warns when the hash differs from the current card data.

- `npm run simulate` (Phase 1): Stage-Setter sweep over the full inventory, asserts **100% coverage by the §4.1 table and 0 engine errors**, writes `logs/simulations/simulation_summary.md` (coverage, failures, balance report) and `logs/simulations/replay_catalog.json`. Phase 2 adds the Scarcity Gauntlet (20 matches across all 5 Core heroes, aspects, Solo and 2-Player, Standard and Expert) before the sweep and reports its extra findings.
- `npm run simulate -- --card <cardCode>` (Phase 1): Stage-Setter for that card, printing each ability's before/after delta and replay command.
- `npm run simulate -- --replay <recipeIdOrSeed>` (Phase 1): replays a recorded recipe and verifies identical state and coverage output.
- `npm run simulate -- --seed <n>` (Phase 1): seeds the run.
- `npm run simulate -- --update-stats` (Phase 2): merges the run's `StatsDelta` into [card_play_stats.json](../../stats/card_play_stats.json).

### 4.6 Extra Invariants (`src/engine/state/state-validator.ts`) — Phase 1

Added to `assertGameStateInvariants` so every existing caller benefits: card conservation across zones (no card created or lost), no negative threat, no card instance in two zones. Each has a failing-state unit test.

---

## 5. Files to Create or Modify

| File | Phase | Change |
| :--- | :---: | :--- |
| `src/engine/simulation/ability-coverage.ts` | 1 | **New:** inventory, per-timing covered rule, ledger, `SimulationRecipe` type |
| `src/engine/simulation/effect-delta-verifier.ts` | 1 | **New:** `StateDigest`, `engine.stepError` detector, registry-based verifier |
| `src/engine/simulation/ability-stage-setter.ts` | 1 | **New:** legality-driven stage-setter and trigger driver |
| `src/engine/effects/` (handlers) | 1 | Add expected-delta contract beside each effect primitive (registry) |
| [src/engine/state/state-validator.ts](../../src/engine/state/state-validator.ts) | 1 | Add card-conservation, non-negative threat, single-zone invariants |
| [src/engine/simulation/match-simulator.ts](../../src/engine/simulation/match-simulator.ts) | 1, 2 | P1: fail on `engine.stepError`. P2: branch-rotating prompt resolution, optional `coverageLedger` |
| `src/engine/simulation/scarcity-matchmaker.ts` | 2 | **New:** scarcity-weighted deck builder and trigger-window combo drafter |
| [src/engine/simulation/player-bot.ts](../../src/engine/simulation/player-bot.ts) | 2 | Scarcity weights, paid/encounter ability support, prerequisite enabling, frozen ledger |
| [src/engine/index.ts](../../src/engine/index.ts) | 1, 2 | Export new simulation modules |
| [scripts/simulate-games.ts](../../scripts/simulate-games.ts) | 1, 2 | Replace win-rate gate with coverage gate and CLI flags (see §4.5) |
| `tests/engine/card-ability-coverage.test.ts` | 1 | **New:** CI gate and verifier tests |
| `tests/engine/effect-delta-registry.test.ts` | 1 | **New:** every effect primitive has a contract |
| [tests/engine/state-validator.test.ts](../../tests/engine/state-validator.test.ts) | 1 | New invariant failing-state tests (extend the existing validator test file) |
| [tests/engine/deterministic-simulation.test.ts](../../tests/engine/deterministic-simulation.test.ts) | 1 | Extend replay checks to recipes (state-identical, not only outcome) |
| [tests/engine/match-simulator.test.ts](../../tests/engine/match-simulator.test.ts) | 1, 2 | P1: `engine.stepError` detection. P2: branch rotation |
| [tests/engine/player-bot.test.ts](../../tests/engine/player-bot.test.ts) | 2 | Scarcity protection, paid/encounter abilities, prerequisites, combo holding |
| [docs/roadmap_and_milestones.md](../roadmap_and_milestones.md) | 2 | Tick item 1.4 (`#431`) |
| [docs/backlog/teamwork_status_and_next_target.md](teamwork_status_and_next_target.md) | 1, 2 | Link plan and reviewer doc now; remove row `#431` and delete both docs in the final delivery commit |
| `changes/unreleased/431-card-ability-coverage-simulation.md` | 1, 2 | **New:** changelog fragment (one per phase PR) |

---

## 6. Phasing

- **Phase 1 PR (the gate):** `engine.stepError` failure in `runMatch`, new invariants, Effect-Delta Registry and verifier, coverage inventory and per-timing rule, legality-driven Stage-Setter with trigger driver and axes, trigger-window combo sweep, `--card` / `--replay` / `--seed`, CI coverage test. Ends with a green 100% Stage-Setter gate.
- **Phase 2 PR (exploration):** scarcity ledger and matchmaker, bot weights and prerequisite enabling, paid and encounter `chooseAbility`, branch-rotating prompts, Gauntlet in `npm run simulate`, `--update-stats`. Removes `isFreeCost` and in-order prompt debt, ticks roadmap 1.4, deletes the plan and reviewer docs, and creates the rule-keyed coverage follow-up issue.

---

## 7. Test Plan (TDD — Written First)

1. **`tests/engine/card-ability-coverage.test.ts` (Phase 1):**
   - Inventory count matches the live catalog; every timing in the data has a "covered" rule (fails on an unknown timing).
   - Registry verifier detects a silent no-op step versus a real mutation, and permits a no-op when `gate` is false.
   - Full Stage-Setter sweep reaches 100% by the §4.1 table with 0 `engine.stepError` and all invariants passing, for 1p and 2p.
   - An ability the setter cannot drive fails with `{ cardCode, abilityId, unmetPrecondition }` (use a synthetic card).
   - Trigger-window pairs resolve in rule order.
   - A recorded `SimulationRecipe` replays to an identical state digest; a changed card-data hash produces a warning.
2. **`tests/engine/effect-delta-registry.test.ts` (Phase 1):** every effect primitive has a contract.
3. **Validator tests (Phase 1):** each new invariant has a failing-state case and a passing case.
4. **`tests/engine/match-simulator.test.ts`:** P1: fails fast on `engine.stepError`. P2: rotates all 3 branches of *Nick Fury* (`01084`) across 3 rotation seeds.
5. **`tests/engine/player-bot.test.ts` (Phase 2):**
   - Protects a 0-play card from being spent as a resource when a tested card can pay.
   - Activates a paid `ACTION` ability (`resourceCost` / `discardCard`) and an encounter attachment `ACTION` ability (*Armored Rhino Suit* `01098` / *Charge* `01099`) when legal.
   - Flips to `ALTER_EGO` when holding an untested `ALTER_EGO_ACTION` card and threat is safe.
   - Takes a safe undefended hit in `chooseDefenderOption` when holding an untested heal card (*First Aid* `01086`).
   - Plays a Black Panther upgrade before *Wakanda Forever!* (`01043a`–`01043d`) when both are in hand.
   - Decisions are identical across two runs from the same frozen ledger.

---

## 8. Open Decisions

All design questions from the `/grill-me` session and the plan review are resolved. Approve this plan (or click **Proceed**) to start Phase 1 TDD implementation.
