# Read-through: Bomb Scare (`01109` to `01112`)

Item 14 of the status file. Verdicts: **OK**, **DEFECT**, **GAP** ([#265](https://github.com/SteveRodrigue/MCD/issues/265)). Date 2026-10-09; no data was edited.

| Code    | Card         | Verdict    | Evidence                                                                                                                                                                                                                                                  |
| :------ | :----------- | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01109` | Bomb Scare   | OK         | `ADD_THREAT` 1 per hero; Acceleration icon is a card field.                                                                                                                                                                                               |
| `01110` | Hydra Bomber | OK         | `PLAYER_CHOICE`: 2 damage to your identity (`SELF_IDENTITY`) or 1 threat on the main scheme (fixed by #133).                                                                                                                                              |
| `01111` | Explosion    | **DEFECT** | Printed: "assign X damage among heroes and allies, X = threat on Bomb Scare". Data: `DEAL_DAMAGE` X to `ALL_HEROES_AND_ALLIES`, i.e. X damage to each. Wrong total; the players should divide X. The surge branch (`IF_CARD_IN_PLAY` negated) is correct. |
| `01112` | False Alarm  | OK         | `ADD_STATUS CONFUSED` on `SELF_IDENTITY`, surge on `ALREADY_HAD_STATUS` (#242).                                                                                                                                                                           |

## Findings

1. `01111` Explosion: damage is multiplied by the number of targets. Needs an "assign X damage among" primitive (player divides the total), then a data fix.
