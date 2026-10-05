# Plan: Core review B7, Med Team `01080` heals "a friendly character", not any character

> **Status:** implemented 2026-10-04 (approved; committed `8dc2fe7`). Tier 1 (data only, plus tests). Tracker: [plan_core_player_cards_review.md](plan_core_player_cards_review.md).
> **UI / Card Editor impact:** none. `CHOSEN_FRIENDLY_CHARACTER` is already in `TargetSelectorSchema`, so the editor dropdowns and the spec (`03_costs_and_targeting.md`) already list it. No new schema.

## 1. Printed text (upstream `core` 01080, support, Protection, cost 3, trait S.H.I.E.L.D.)

> Uses (3 medical counters). *(Enters play with 3 counters. When those are gone, discard this card.)*
> **Action**: Exhaust Med Team and remove 1 medical counter from it → heal 2 damage from a **friendly** character.

Rules lookup (`npm run rule -- friendly`): "Friendly is a blanket term that refers to cards the players control." The engine selector `CHOSEN_FRIENDLY_CHARACTER` is the hero identity or an ally of any player (`target-resolver.ts`, candidate list at the `getEligibleTargets` case and the resolve case).

## 2. Original supplemental data (`core.json`, `01080`)

```json
"steps": [
  { "effect": "HEAL_DAMAGE", "effectParams": { "amount": 2, "target": "CHOSEN_CHARACTER" } }
]
```

(`uses`, `cost` with `exhaustSelf` and `spendCounters`, `timing: ACTION` are correct and unchanged.)

## 3. Proposed supplemental data

```json
"steps": [
  { "effect": "HEAL_DAMAGE", "effectParams": { "amount": 2, "target": "CHOSEN_FRIENDLY_CHARACTER" } }
]
```

`audit.updatedAt` and `reviewedAt` bumped; `audit.comment` untouched.

## 4. Why

`CHOSEN_CHARACTER` includes enemies. Two concrete effects today:

1. A player can spend a Med Team counter to heal the **villain** or a minion.
2. The action legality check (`legality-checker.ts` 5D, and the card-play check around L1024) uses the same selector with `{ damaged: true }`, so when no friendly character is damaged but the villain is, Med Team's action is offered even though it has no legal friendly target.

Contrast: _First Aid_ `01086` prints "any character" and correctly keeps `CHOSEN_CHARACTER`. These two are the only `CHOSEN_CHARACTER` uses in `core.json`, so no other card needs the same fix.

## 5. Engine check (Step 6 of the protocol)

- `HEAL_DAMAGE` heals hero/alter-ego health and ally damage tokens for any resolved target (`effects/index.ts` L2579+). No change.
- `getEligibleTargets(..., 'CHOSEN_FRIENDLY_CHARACTER', { damaged: true })` returns each player's identity (current form) and every player's allies, then the `damaged` filter applies (`target-resolver.ts` L1751+). No change.
- Expected: no engine change. If a failing test shows otherwise (for example a missing `damaged` branch for allies), I stop and report before editing the engine.

## 6. Tests (TDD, written first and seen failing)

New `tests/engine/med-team-friendly-target.test.ts`, through `canInitiateAbility` and `dispatchAction` (`USE_CARD_ABILITY`):

1. Only the villain is damaged, heroes and allies undamaged: the action is **not** initiable (fails today).
2. Villain damaged and the chosen target is the villain: the action is rejected, the villain is not healed, no counter is spent (fails today).
3. Another player's damaged ally: Med Team heals it by 2 and spends one counter (guards the selector).
4. A damaged hero in alter-ego form is a valid target (identity of either form).

The existing Med Team tests in `target-legality-requirements.test.ts` and `uses-counter-depletion-invariants.test.ts` must keep passing unchanged.

## 7. Files

`src/data/supplemental/pack/core.json` (textual edit, `01080` only), the new test file, `CHANGELOG.md` `[Unreleased]`, the tracker status table, `teamwork_status_and_next_target.md`, and `npm run report:declarations`.

## 8. Open decisions

None. One note for you: the tracker also lists C-items that touch nearby cards (C1 to C5, C8, C11); I will plan each separately, one at a time, as before.
