# Plan: WP8, Electric Whip Attack `01173` ([#241](https://github.com/SteveRodrigue/MCD/issues/241))

> **Status:** boost implemented 2026-10-04; When Revealed completed with #222 (see `plan_issue_222_self_hero_selector.md`) and #241 closed there. Originally: implemented 2026-10-04 (WP8 was pre-authorised by the user to follow WP4 without a further stop unless a decision was needed; none was). Boost fixed and tested; the When Revealed half is stripped under the circuit-breaker and blocked on #222, so **#241 stays open**. Part of [plan_effect_params_remediation.md](plan_effect_params_remediation.md).
> **Tier:** 1 (data and tests; the engine work is WP4's `UNDEFENDED_ATTACK`). **UI / Card Editor impact:** none.

## 1. Printed text (upstream `core_encounter` 01173, treachery, star boost)

> **When Revealed**: Choose to either deal 1 damage to your hero for each upgrade you control or choose and discard an upgrade you control.
> [star] **Boost**: If the villain is making an undefended attack, choose and discard an upgrade you control.

## 2. Original supplemental data

Two abilities, neither matching the card: a `CONSTANT` `MODIFY_STAT { stat: ATTACK, amount: 1 }` (not on the card), and a `BOOST` `DISCARD` of `source: TABLEAU`, `filter.types: [upgrade, support]`, `target: DEFENDING_PLAYER` with no undefended condition. No When Revealed ability.

## 3. Proposed (and applied) supplemental data

```json
{
  "id": "electric_whip_attack_boost",
  "timing": "BOOST",
  "trigger": "BOOST",
  "steps": [
    { "effect": "DISCARD",
      "gate": "IF_CONDITION_MET",
      "condition": "UNDEFENDED_ATTACK",
      "gateParams": { "attackerKind": "VILLAIN" },
      "effectParams": { "source": "TABLEAU", "filter": { "types": ["upgrade"] }, "target": "DEFENDING_PLAYER" } }
  ]
}
```

The invented `CONSTANT` ability is removed. `audit`: `confidence` 70, `ambiguityFile` set, timestamps bumped, `reviewedBy` `claude` (same as the other stripped core encounter cards); `audit.originalText` and `audit.comment` untouched.

## 4. Why

- Invented `+1 ATTACK`: nothing on the card grants it (the star boost is the only ability besides When Revealed).
- Filter: the card says *an upgrade*, not "upgrade or support".
- Condition: same root cause as #229; reuses the generic `UNDEFENDED_ATTACK` condition from WP4.
- **When Revealed not modelled (circuit-breaker, no decision needed):** its first option deals damage to "your hero", which is never the alter-ego. The engine has no form-literal hero selector (#222); `SELF_IDENTITY` would hit the alter-ego in alter-ego form, and shipping only the discard option would remove the player's choice. Same treatment and precedent as Titania's Fury `01164` (When Revealed stripped, boost kept). Ambiguity report: `docs/ambiguities/core_encounter_01173_electric-whip-attack.md`.

## 5. Tests (written first, all five failed before the data change)

`tests/engine/electric-whip-attack.test.ts`: discards the only upgrade and keeps a support on an undefended villain attack; with several upgrades only upgrades are offered and the chosen one is discarded; nothing happens when the hero defends; no upgrade means no discard and no crash (a support is never discarded); no invented abilities remain (only `BOOST`, no `MODIFY_STAT`). The pre-existing Electric Whip test in `combat-boost-and-star-abilities.test.ts` keeps passing unchanged.

## 6. Files

`src/data/supplemental/pack/core_encounter.json` (`01173` only), `docs/ambiguities/core_encounter_01173_electric-whip-attack.md`, the new test file, `CHANGELOG.md`, trackers, `npm run report:declarations`.

## 7. Open item

When #222 lands, finish the When Revealed choice as described in the ambiguity file, then close #241 and delete the ambiguity file.
