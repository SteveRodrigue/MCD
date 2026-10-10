# Read-through: Masters of Evil (`01128` to `01133`)

Item 14 of the status file. Verdicts: **OK**, **DEFECT**, **GAP** ([#265](https://github.com/SteveRodrigue/MCD/issues/265)). Date 2026-10-09; no data was edited. All six cards have text and no entry.

| Code    | Card                | Verdict | Mechanics the entry needs                                                                                                                              |
| :------ | :------------------ | :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01128` | The Masters of Evil | GAP     | When Revealed: discard until a Masters of Evil minion, put it into play engaged with the first player.                                                 |
| `01129` | Radioactive Man     | GAP     | Forced Response after it attacks you: discard 1 random card from your hand. Boost: same discard.                                                       |
| `01130` | Whirlwind           | GAP     | Forced Interrupt: when he attacks you, also resolve his attack against each other hero (multi-defender attack). Boost: 1 damage to each hero.          |
| `01131` | Tiger Shark         | GAP     | Forced Response after he attacks: give him a tough status card. Boost: give the villain a tough status card.                                           |
| `01132` | Melter              | GAP     | Constant "the engaged player must defend with an ally if able" (defender restriction). Boost: exhaust each ally you control.                           |
| `01133` | Masters of Mayhem   | GAP     | Each Masters of Evil minion attacks the hero it is engaged with; if no attack was made, search for one and put it into play engaged with you, shuffle. |

## Findings

No defect. 6 GAP rows feed #265. Engine needs spotted: attack against several players (`01130`), forced defender type (`01132`), "if no attacks were made" result (`01133`, `ENEMY_ATTACKS` covers one named enemy only).
