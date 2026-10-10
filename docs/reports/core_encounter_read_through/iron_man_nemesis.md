# Read-through: Iron Man nemesis (`01171` to `01174`)

Item 14 of the status file. Verdicts: **OK**, **DEFECT**, **GAP** ([#265](https://github.com/SteveRodrigue/MCD/issues/265)). Date 2026-10-09; no data was edited.

| Code    | Card                     | Verdict    | Evidence                                                                                                                                                                                                                                                             |
| :------ | :----------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01171` | Imminent Overload        | OK         | `ADD_THREAT` 1 per hero; the printed icon is Acceleration (#132).                                                                                                                                                                                                    |
| `01172` | Whiplash                 | **DEFECT** | Printed text is Retaliate 1 only. Data keeps `GRANT_KEYWORD Retaliate 1` (fine, redundant with the printed keyword) and adds a Forced Response on `WHEN_REVEALED` giving Whiplash a tough status card. Invented; confidence 98 hides it. Strip the first ability.    |
| `01173` | Electric Whip Attack     | OK         | When Revealed: `PLAYER_CHOICE` of 1 damage per upgrade to `SELF_HERO` or discard a chosen upgrade; Boost gated `IF_UNDEFENDED_ATTACK` (villain), discard an upgrade. `DEFENDING_PLAYER` falls back to the resolving player outside an attack (`target-resolver.ts`). |
| `01174` | Electromagnetic Backlash | OK         | `forEachPlayer`: discard 5 from the deck, then damage to that player's identity per printed energy icon (#220). Confidence 95.                                                                                                                                       |

## Findings

1. `01172` Whiplash: invented tough-on-reveal ability.
