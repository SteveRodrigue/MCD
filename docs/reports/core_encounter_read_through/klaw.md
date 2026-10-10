# Read-through: Klaw (`01113` to `01127`)

Item 14 of the status file. Verdicts: **OK**, **DEFECT**, **GAP** ([#265](https://github.com/SteveRodrigue/MCD/issues/265)). Date 2026-10-09; no data was edited. Every card below except `01121` has rules text and no supplemental entry, so none of it is executed today.

| Code     | Card                        | Verdict | Mechanics the entry needs                                                                                                                             |
| :------- | :-------------------------- | :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01113`  | Klaw (I)                    | GAP     | Forced Interrupt "when Klaw attacks, 1 additional boost card" (`GIVE_ADDITIONAL_BOOST_CARD`, exists).                                                 |
| `01114`  | Klaw (II)                   | GAP     | Same Forced Interrupt; When Revealed `SEARCH` for `01127`, reveal, shuffle.                                                                           |
| `01115`  | Klaw (III)                  | GAP     | Toughness (keyword) and the same Forced Interrupt.                                                                                                    |
| `01116a` | Underground Distribution 1A | GAP     | Scenario setup: search `01125` Defense Network, reveal, shuffle, advance ([#275](https://github.com/SteveRodrigue/MCD/issues/275)).                   |
| `01116b` | Underground Distribution 1B | GAP     | When Revealed: discard until a minion, put it into play engaged with the first player (`DISCARD UNTIL_MATCH` + a put-into-play destination).          |
| `01117a` | Secret Rendezvous 2A        | GAP     | Same minion step, then advance.                                                                                                                       |
| `01117b` | Secret Rendezvous 2B        | GAP     | Loss on completion (engine rule); only the text is missing from the data.                                                                             |
| `01118`  | Sonic Converter             | GAP     | Attach to Klaw; Forced Response after Klaw attacks and damages a character: stun it (needs the "damaged a character" fact); Hero Action `E M P` cost. |
| `01119`  | Solid-Sound Body            | GAP     | Klaw gains Retaliate 1; Hero Action `E M P` discard.                                                                                                  |
| `01120`  | Armored Guard               | GAP     | Guard and Toughness (printed keywords; probably a `noSupplementalNeeded` entry).                                                                      |
| `01121`  | Weapons Runner              | OK      | Surge keyword; Boost `PUT_INTO_PLAY` self engaged with you (#244).                                                                                    |
| `01122`  | Klaw's Vengeance            | GAP     | Alter-Ego: discard 1 random card from hand. Hero: Klaw attacks you; if the attack deals damage, 1 threat on the main scheme.                          |
| `01123`  | Sonic Boom                  | GAP     | When Revealed: choose spend `E M P` or exhaust each character you control. Boost: if this activation deals damage to you, exhaust your hero.          |
| `01124`  | Sound Manipulation          | GAP     | Alter-Ego: Klaw heals 4, surge if none healed. Hero: take 2 damage, Klaw heals 2.                                                                     |
| `01125`  | Defense Network             | GAP     | `ADD_THREAT` 1 per hero (same as `01107`).                                                                                                            |
| `01126`  | Illegal Arms Factory        | GAP     | `ADD_THREAT` 1 per hero.                                                                                                                              |
| `01127`  | The "Immortal" Klaw         | GAP     | Constant "+10 hit points" on Klaw, lost when the scheme is defeated (`MODIFY_MAX_HEALTH` for the villain).                                            |

## Findings

No defect (nothing is modelled). 16 GAP rows feed #265. Engine needs spotted: "this attack damaged a character" fact (shared with `01106`), put a discarded minion into play engaged, villain `MODIFY_MAX_HEALTH`.
