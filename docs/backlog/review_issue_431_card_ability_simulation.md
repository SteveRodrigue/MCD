# Code Review Checklist: #431 Card-Ability & Combo Coverage Simulation

**For the reviewer.** Companion to [plan_issue_431_card_ability_simulation.md](plan_issue_431_card_ability_simulation.md). Use it per phase PR. Each cue says what to look for, where, and how to fail it. Delete this file in the final delivery commit together with the plan.

**Phase tags:** `[P1]` = Phase 1 PR (the gate), `[P2]` = Phase 2 PR (exploration). In a Phase 1 review, skip `[P2]` items, but check they were **not** half-added.

---

## 1. Plan promises -> must exist

| Promise | Where to look | Fail if |
| :--- | :--- | :--- |
| `[P1]` `runMatch` fails on `engine.stepError` | `src/engine/simulation/match-simulator.ts`; test in `tests/engine/match-simulator.test.ts` | No test where a logged `engine.stepError` fails the run; or failure is opt-out by default |
| `[P1]` `SimulationRecipe` has `seed`, `botSeed`, decks, scenario, difficulty, player count, rotation seed, frozen ledger, card-data hash | `src/engine/simulation/ability-coverage.ts` | Any field missing, or ledger/hash not stored |
| `[P1]` `--card`, `--replay`, `--seed` parsed | `scripts/simulate-games.ts` | A flag is documented but ignored (the old script printed an unparsed `--seed` hint) |
| `[P2]` `--update-stats` is the only path that writes `stats/card_play_stats.json` | `scripts/simulate-games.ts` | Any write to the stats file without the flag |
| `[P1]` `simulation_summary.md` and `replay_catalog.json` written to `logs/simulations/` | script output | Written elsewhere, or committed to git |
| `[P1]` Old win-rate gate removed | `scripts/simulate-games.ts` | Both gates coexist, or a legacy flag/toggle remains |

## 2. One Legality Gate

- `[P1]` The Stage-Setter repairs preconditions **reported by** `legality-checker.ts` / `checkAbilityTargets`; it does not contain its own cost, target, timing, or form rules.
  - Cue: `rg -n "resourceCost|identityForm|exhaust|isReady" src/engine/simulation/ability-stage-setter.ts`. Any rule logic that decides legality (not just *applies a repair*) fails.
- `[P1/P2]` Every action goes through `dispatchAction` or canonical entry points (`step4_revealEncounterCards`, `executeVillainAttackAgainstPlayer`). Cue: no direct state mutation to "fire" an ability (`state.players[...] =` outside the setup-sculpt step).
- `[P2]` `chooseAbility` uses `getLegalActionsForPlayer(...).villainActionItems`, not a second scan.
- Fail on any new parallel playability check in a caller (project rule, `docs/coding_guidelines.md` §15.11).

## 3. Coverage truth

- `[P1]` Every Core timing has a "covered" rule: `WHEN_REVEALED`, `BOOST`, `HERO_ACTION`, `ALTER_EGO_ACTION`, `ACTION`, `RESPONSE`, `FORCED_RESPONSE`, `INTERRUPT`, `HERO_INTERRUPT`, `FORCED_INTERRUPT`, `CONSTANT`, `RESOURCE`, `HERO_RESOURCE`, `SETUP`, `SPECIAL`. A test fails on an unknown timing.
- `[P1]` `CONSTANT` is covered only on an **observed** modifier in a digest, not on "card is in play".
- `[P1]` `RESOURCE`/`HERO_RESOURCE` covered only when resource is generated/paid through the card; `SETUP` only inside `setupGame`.
- `[P1]` All 4 `SPECIAL` abilities are listed in the test with their observable. No catch-all.
- `[P1]` Inventory asserts the live count (143 cards / 161 abilities at plan time) from the catalog, not a hardcoded constant that rots.
- `[P1]` **No allowlist / skip list** for abilities. An undrivable ability fails with `{ cardCode, abilityId, unmetPrecondition }`. Cue: `rg -n "skip|allowlist|ignore|exclude|TODO" src/engine/simulation tests/engine/card-ability-coverage.test.ts`.
- `[P1]` Encounter-facing abilities run for 1p **and** 2p; hero **and** alter-ego where the card cares.
- `[P1]` `PLAYER_CHOICE` branches each exercised (e.g. *Nick Fury* `01084`, *Vision* `01068`).

## 4. Effect-Delta Registry

- `[P1]` Every effect primitive in `src/engine/effects/` has a declared expected delta beside its handler.
- `[P1]` `tests/engine/effect-delta-registry.test.ts` fails when a primitive lacks a contract. Verify by temporarily removing one contract.
- `[P1]` No-op steps pass **only** when the step's `gate` evaluated false. A step that ran and changed nothing must fail.
- `[P1]` Contracts account for prevention/replacement (damage prevention, shields), not just raw `amount`.
- `[P1]` Verifier also checks: no new `engine.stepError`, no stuck prompts/pending sequences after `drainPrompts`, `assertGameStateInvariants`, and `abilitiesUsed` for use-event timings.

## 5. Determinism & replay

- `[P1]` Bot and engine use separate RNG streams (`botSeed` vs `seed`). Changing bot behaviour must not change engine shuffles.
- `[P1/P2]` No `Math.random` / `Date.now` in `src/engine/simulation/`. Cue: `rg -n "Math\.random|Date\.now|new Date" src/engine/simulation`.
- `[P2]` Bot reads the **frozen** ledger snapshot from the recipe, never the live ledger. Test: same recipe twice gives identical decisions.
- `[P1]` Replay test compares full state digest, not just win/loss.
- `[P1]` Card-data hash mismatch produces a warning in `--replay`.
- `[P1]` Run twice with the same `--seed`: byte-identical `replay_catalog.json` (ignoring timestamps, which should not exist).

## 6. Invariants (`state-validator.ts`)

- `[P1]` Added to `assertGameStateInvariants` (not a simulator-local copy): card conservation across zones, no negative threat, no card instance in two zones.
- `[P1]` Each has a **failing-state** test (hand-built corrupt state) and a passing case.
- `[P1]` No false positives on existing suites. Run the validator-related tests and `deterministic-simulation.test.ts`.

## 7. Engine boundary & zero-bloat

- `src/engine/` free of React/DOM/CSS imports.
- No card-name or card-code hardcoding in simulation or setter logic (ADR-0021). Cue: `rg -n "'0[0-9]{4}[a-z]?'" src/engine/simulation` should hit nothing outside tests.
- No shims, aliases, deprecated names, duplicate paths, skipped or `todo` tests.
- `[P2]` `isFreeCost` free-only restriction is actually removed (not bypassed with a flag).
- `[P2]` `resolveDecisionPromptHeuristically` no longer picks "first enabled option that dispatches"; rotation is deterministic and seed-driven.
- `[P2]` No second bot file or legacy policy toggle; one `chooseBotAction`, one `BOT_POLICY`.
- Replay tests extend `deterministic-simulation.test.ts` / the ADR-0081 test in `match-simulator.test.ts`, no parallel replay suite.
- Each new function: was a similar one searchable and merged instead (Refactor-First policy)?

## 8. Tests to run

```bash
rtk npx vitest run tests/engine/card-ability-coverage.test.ts tests/engine/effect-delta-registry.test.ts
```

```bash
rtk npx vitest run tests/engine/deterministic-simulation.test.ts tests/engine/match-simulator.test.ts tests/engine/player-bot.test.ts
```

```bash
rtk npm run typecheck
```

```bash
rtk npm run lint
```

```bash
rtk npm run simulate
```

Expect: 100% coverage, 0 engine errors, summary and catalog written. Then `npm run simulate -- --card 01084` and a `--replay` of a recorded recipe. The full suite is left to the pre-push hook.

## 9. Docs & delivery

- `[P2]` `docs/roadmap_and_milestones.md` item 1.4 ticked only after Phase 2.
- `[P1/P2]` Changelog fragment in `changes/unreleased/` per phase.
- `[Final]` Row `#431` removed from `docs/backlog/teamwork_status_and_next_target.md`; plan and this checklist deleted.
- `[Final]` Follow-up issue for rule-keyed glossary coverage created and linked from the PR.
- ADR / `docs/coding_guidelines.md` updated if a new rule was introduced (e.g. effect-delta contracts for new primitives). Fail if new primitives can be added without a contract and nothing says so.
- PR body names the issue (`Fixes #431` only on the final phase PR; earlier phase uses `Refs #431`).

## 10. Red flags / common misses

1. `CONSTANT` abilities marked covered without an observed modifier.
2. 2p-only encounter behaviour (each player / first player) never run.
3. Replay test asserting only win/loss, not state.
4. Stats file written without `--update-stats`, or CI test reading `card_play_stats.json`.
5. Stage-Setter quietly re-implementing a legality rule.
6. Gauntlet result used as a pass/fail gate (it must stay exploratory).
7. `try/catch` around step execution that swallows `engine.stepError` again.
8. Effect contracts that only check "something changed".
9. Stage-Setter loop with no iteration cap or no named failure reason.
10. Hardcoded counts (143 / 161) in tests instead of live inventory.
11. Wrong card codes in tests: Wakanda Forever! is `01043a`–`01043d`, not `01043`; First Aid is `01086`.
12. Balance report presented as a gate or as representative play.
