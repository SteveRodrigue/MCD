# Read-through: Spider-Man nemesis (`01166` to `01169`)

Item 14 of the status file. Verdicts: **OK**, **DEFECT**, **GAP** ([#265](https://github.com/SteveRodrigue/MCD/issues/265)). Date 2026-10-09; no data was edited.

| Code    | Card                | Verdict | Evidence                                                                                                                                                   |
| :------ | :------------------ | :------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01166` | Highway Robbery     | OK      | `ATTACH_FACEDOWN_CARDS_FROM_HAND` (one random card per player, into `cardsUnderneath`); When Defeated `RETURN_TO_HAND` runs before host cleanup (#238).    |
| `01167` | Vulture             | OK      | Quickstrike is a printed keyword handled in `action-dispatcher.ts` and `effects/index.ts` (hero form only); `noSupplementalNeeded`, no `audit.confidence`. |
| `01168` | Sweeping Swoop      | OK      | Stun `SELF_HERO`, surge if `01167` is in play; Boost: stun the damaged character if this activation dealt damage (#221). Confidence 95.                    |
| `01169` | The Vulture's Plans | OK      | `DISCARD` 1 random card from each hand, then threat equal to the number of different resource types discarded (#219). Confidence 95.                       |

## Findings

`01167` has no `audit.confidence` (hygiene only).
