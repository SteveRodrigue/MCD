# Read-through: Under Attack (`01151` to `01154`)

Item 14 of the status file. Verdicts: **OK**, **DEFECT**, **GAP** ([#265](https://github.com/SteveRodrigue/MCD/issues/265)). Date 2026-10-09; no data was edited. All four cards have text and no entry.

| Code    | Card                | Verdict | Mechanics the entry needs                                                                                                           |
| :------ | :------------------ | :------ | :---------------------------------------------------------------------------------------------------------------------------------- |
| `01151` | Under Attack        | GAP     | When Revealed: each player chooses 2 threat here or 3 damage to their hero (`PLAYER_CHOICE` per player, `forEachPlayer`).           |
| `01152` | Vibranium Armor     | GAP     | Attach to the villain; Forced Response after the villain takes damage: tough status card; Hero Action exhaust hero + `P P` discard. |
| `01153` | Concussion Blasters | GAP     | Attach to the villain; Retaliate 1; Hero Action exhaust hero + `E E` discard.                                                       |
| `01154` | Concussive Blast    | GAP     | When Revealed: 1 damage to each friendly character. Boost: 1 damage to each character you control.                                  |

## Findings

No defect. 4 GAP rows feed #265. "Each friendly character" (`01154`) needs a selector decision: friendly = heroes plus allies of every player (compare `ALL_HEROES_AND_ALLIES`, which excludes alter-egos).
