# Read-through: Black Panther nemesis (`01156` to `01159`)

Item 14 of the status file. Verdicts: **OK**, **DEFECT**, **GAP** ([#265](https://github.com/SteveRodrigue/MCD/issues/265)). Date 2026-10-09; no data was edited.

| Code    | Card              | Verdict    | Evidence                                                                                                                                                                                                                                                                                                     |
| :------ | :---------------- | :--------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01156` | Usurp The Throne  | OK (check) | Upstream prints no rules text (hazard icon only); `noSupplementalNeeded`, no `audit.confidence`. Compare with the physical card once: a side scheme with no When Revealed is unusual.                                                                                                                        |
| `01157` | Killmonger        | **DEFECT** | Printed: "Killmonger cannot take damage from Black Panther upgrades." Data: a Forced Response on `WHEN_REVEALED` that gives Killmonger a tough status card. Invented; and the real sentence (damage immunity by source type) is not declared. No `audit.confidence`. Needs a damage-source filter primitive. |
| `01158` | Heart-Shaped Herb | OK         | Surge keyword; `ADD_STATUS TOUGH` on `ENGAGED_ENEMIES` (the active villain plus the resolving player's engaged minions, `target-resolver.ts`); Boost: tough on the villain (#244).                                                                                                                           |
| `01159` | Ritual Combat     | OK         | Discard the top encounter card, then `PLAYER_CHOICE`: X damage to `SELF_HERO` or X threat on the main scheme, X = boost icons of the discarded card + 1.                                                                                                                                                     |

## Findings

1. `01157` Killmonger: invented tough status; the printed damage immunity is missing (strip, block, file the primitive).
2. `01156` and `01157` have no `audit.confidence`.
