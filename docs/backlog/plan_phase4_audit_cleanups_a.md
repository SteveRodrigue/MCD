# Plan: Phase 4, group A — audit cleanups #195, #192, #196, #197, #198

> Status: **Awaiting approval** (no source or test edits made yet)
> Source: `teamwork_status_and_next_target.md`, Phase 4 first line ("#192, #195, #196, #197, #198").
> All five are behavior-neutral except #195 (one log key string). No gameplay rules involved, no UI visual change, no Card Editor impact.

## Order and scope

| # | Issue | Change | Files | Est. |
|---|---|---|---|---|
| 1 | #195 | Log key `villainPhase.step4.encounterCardsDealt` to `villainPhase.step3.encounterCardsDealt` | `pipeline/villain-phase.ts:531` | 10 min |
| 2 | #192 | Remove the 3 alias exports; migrate callers to canonical names | `villain-phase.ts` + 17 test files | 30 min |
| 3 | #196 | Remove `ScenarioDefinition = LegacyScenarioDefinition` alias | `scenarios/catalog.ts` | 10 min |
| 4 | #197 | Drop the 3 dead `as any` probes in `isFacedown` | `ui/components/cards/CardView.tsx` | 10 min |
| 5 | #198 | Drop dead raw-field (`faction_code`, `set_code`, `type_code`) fallbacks | `ui/components/.../PlayerHandTray.tsx` | 15 min |

Total: about 1.5 hours, one commit per issue (`Fixes #N`).

## Verified facts (differ from the issue text)

- **#195:** the key is at line 531 now (not 305). `src/locales/*/combat-log.json` has no `villainPhase.*` or `encounter.*` keys at all, so the issue's "add the key to the locale files" does not match how keys work today. See decision 1.
- **#192:** aliases are used in 17 test files (the issue says 10): `advanced-mechanics`, `attachments-player`, `cancel-when-revealed`, `caught-off-guard-choice`, `decision-prompt-card-preview`, `encounter-attachment-unconditional`, `hawkeye-minion-enters-play`, `keywords-hazard`, `obligation-recipient`, `obligations-remaining`, `obligations`, `optional-triggers`, `spider-man-cards`, `uses-counter-depletion-invariants`, `villain-phase-card-play-restriction`, `villain-phase-order`, `villain-phase`. No `src/` file outside `villain-phase.ts` uses them.
- **#196:** `tests/engine/starter-decks.test.ts` imports only `getScenario`, not the type. The alias is used inside `catalog.ts` itself (`getScenario`, `listScenarios` return types), so those switch to `LegacyScenarioDefinition`.

## TDD

1. **#195 (red first):** add a test in `villain-phase.test.ts` asserting step 3 logs key `villainPhase.step3.encounterCardsDealt` and no `step4` key. Red until the string changes.
2. **#192:** `villain-phase-order.test.ts` replaces its alias-identity assertion with a check that the canonical exports exist and the three alias names are no longer exported. Red until the aliases are removed; the other 16 files only change imports (compile and run green).
3. **#196, #197, #198:** pure deletions, guarded by `typecheck` plus the existing suites named in each issue (`starter-decks`, `board-deck-piles`, `villain-zone-zoom`, `player-hand-tray-*`). No new test unless a deletion changes a result.

## Verification (each commit)

`rtk npm test`, `rtk npm run typecheck`, `rtk npm run lint`, `rtk npm run format:check`. Baseline: 1,665 passing, 0 failed, 0 skipped.

## Docs

`CHANGELOG.md` (`[Unreleased]`, one entry per issue) and the status in `teamwork_status_and_next_target.md`. No ADR needed.

## Decision needed (one)

1. **#195 locale key.** Recommended: **do not add** locale entries, matching every other engine log key (none are in `combat-log.json`); only fix the string and add the engine test. Alternative: add `villainPhase.step3.encounterCardsDealt` to `en` and `fr` as the issue asks.
