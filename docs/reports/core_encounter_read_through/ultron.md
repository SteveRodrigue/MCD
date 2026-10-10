# Read-through: Ultron (`01134` to `01150`)

Item 14 of the status file. Verdicts: **OK**, **DEFECT**, **GAP** ([#265](https://github.com/SteveRodrigue/MCD/issues/265)). Date 2026-10-09; no data was edited. All 22 cards have text and no entry. The set is built on one mechanic: a facedown **Drone** minion (top card of a deck put into play facedown, engaged, with base SCH 1 / ATK 1 / HP 1 from the `01140` environment).

| Code     | Card                     | Verdict | Mechanics the entry needs                                                                                                                                    |
| :------- | :----------------------- | :------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01134`  | Ultron (I)               | GAP     | Forced Response after Ultron attacks you: choose 1 threat on the main scheme or create a Drone.                                                              |
| `01135`  | Ultron (II)              | GAP     | Forced Interrupt when he attacks you: create a Drone; +1 ATK per Drone engaged with you until end of attack.                                                 |
| `01136`  | Ultron (III)             | GAP     | Drones get +1 ATK and +1 HP; Ultron cannot take damage while a Drone is in play; When Revealed: search for `01150`, reveal, shuffle.                         |
| `01137a` | The Crimson Cowl 1A      | GAP     | Setup: put `01140` into play, shuffle, advance ([#275](https://github.com/SteveRodrigue/MCD/issues/275)).                                                    |
| `01137b` | The Crimson Cowl 1B      | GAP     | When Revealed: each player creates a Drone.                                                                                                                  |
| `01138a` | Assault on NORAD 2A      | GAP     | Each player creates a Drone, advance.                                                                                                                        |
| `01138b` | Assault on NORAD 2B      | GAP     | Forced Response after step-one threat: each player chooses 2 threat here or a Drone.                                                                         |
| `01139a` | Countdown to Oblivion 3A | GAP     | Each player creates a Drone, advance.                                                                                                                        |
| `01139b` | Countdown to Oblivion 3B | GAP     | "Threat cannot be removed from this scheme"; loss on completion.                                                                                             |
| `01140`  | Ultron Drones            | GAP     | Facedown Drone base stats 1/1/1; Forced Response: a defeated facedown Drone goes to its owner's discard pile.                                                |
| `01141`  | Program Transmitter      | GAP     | Attach to Ultron; Forced Response after Ultron schemes: 1 threat on each side scheme; Hero Action exhaust + `M M` discard.                                   |
| `01142`  | Upgraded Drones          | GAP     | Attach to `01140`; facedown Drones get +1 ATK and +1 HP; Hero Action `E M P` discard.                                                                        |
| `01143`  | Advanced Ultron Drone    | GAP     | Guard; Forced Interrupt when defeated: the engaged player creates a Drone.                                                                                   |
| `01144a` | Android Efficiency (a)   | GAP     | Each player creates a Drone. Boost: spend `E` or create a Drone.                                                                                             |
| `01144b` | Android Efficiency (b)   | GAP     | Same, Boost with `M`.                                                                                                                                        |
| `01144c` | Android Efficiency (c)   | GAP     | Same, Boost with `P`.                                                                                                                                        |
| `01145`  | Rage of Ultron           | GAP     | Alter-Ego: Ultron schemes, discard top card per threat placed. Hero: Ultron attacks you, discard top card per damage dealt.                                  |
| `01146`  | Repair Sequence          | GAP     | Ultron heals 2 per Drone engaged with you (surge if none healed). Boost: 1 per Drone.                                                                        |
| `01147`  | Swarm Attack             | GAP     | Each Drone engaged with your hero attacks; if none attacked, create a Drone.                                                                                 |
| `01148`  | Drone Factory            | GAP     | Each player creates a Drone; place 1 threat here per Drone in play (mixed per-player and run-once: [#272](https://github.com/SteveRodrigue/MCD/issues/272)). |
| `01149`  | Invasive AI              | GAP     | Each player discards the top 3 cards of their deck.                                                                                                          |
| `01150`  | Ultron's Imperative      | GAP     | The first player creates 2 Drones.                                                                                                                           |

## Findings

No defect. 22 GAP rows feed #265. The whole set waits on one primitive: a facedown Drone minion from a deck card, with environment-scoped base stats and a defeat destination. Without it, none of the 22 can be entered.
