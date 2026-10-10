# Read-through: She-Hulk nemesis (`01161` to `01164`)

Item 14 of the status file. Verdicts: **OK**, **DEFECT**, **GAP** ([#265](https://github.com/SteveRodrigue/MCD/issues/265)). Date 2026-10-09; no data was edited.

| Code    | Card                 | Verdict | Evidence                                                                                                                                                                                                           |
| :------ | :------------------- | :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01161` | Personal Challenge   | OK      | `ADD_THREAT` 1 per hero on the scheme; Crisis icon is a card field.                                                                                                                                                |
| `01162` | Titania              | OK      | Printed ATK is X = remaining hit points. `MODIFY_STAT ATTACK` `REMAINING_HIT_POINTS` on a base of 0 (`getEffectiveMinionAttack` clamps the printed `-1` to 0). Confidence 95.                                      |
| `01163` | Genetically Enhanced | OK      | `attachTo` highest printed hit points, otherwise surge; `MODIFY_MAX_HEALTH` +3 (#209, #228). Confidence 95.                                                                                                        |
| `01164` | Titania's Fury       | OK      | `ENEMY_ATTACKS` `01162` on `SELF_HERO`; on no attack, `HEAL_DAMAGE ALL` and `SURGE` gated on the failed step; Boost: `GIVE_ADDITIONAL_BOOST_CARD`. Covered by `tests/engine/enemy-attacks.test.ts`. Confidence 95. |

## Findings

None.
