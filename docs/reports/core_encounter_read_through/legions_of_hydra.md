# Read-through: Legions of Hydra (`01180` to `01182`)

Item 14 of the status file. Verdicts: **OK**, **DEFECT**, **GAP** ([#265](https://github.com/SteveRodrigue/MCD/issues/265)). Date 2026-10-09; no data was edited. All three cards have text and no entry.

| Code    | Card             | Verdict | Mechanics the entry needs                                                                                                                                                 |
| :------ | :--------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `01180` | Legions of Hydra | GAP     | If `01181` is not in play: search deck and discard, put into play engaged with you, shuffle. Place 2 additional threat per Hydra enemy in play (`ENTITY_COUNT` by trait). |
| `01181` | Madame Hydra     | GAP     | Cannot take damage while `01180` is in play (constant damage prevention gated on a card in play); Forced Response after she schemes or attacks: 2 threat on `01180`.      |
| `01182` | Hydra Soldier    | GAP     | Guard; When Defeated: deal the engaged player an encounter card.                                                                                                          |

## Findings

No defect. 3 GAP rows feed #265.
