---
type: Fixed
---

- **Fix (Engine, Data): The Ultron cards that read Drones ([Issue #352](https://github.com/SteveRodrigue/MCD/issues/352))**
  - New card data: Ultron I, II and III (without III's When Revealed), Assault on NORAD 2B, Upgraded Drones, Android Efficiency's Boost, Repair Sequence, Swarm Attack and Drone Factory.
  - Each Drone minion can now be buffed by cards it is not attached to: a CONSTANT `MODIFY_STAT` or `MODIFY_MAX_HEALTH` with `target: ALL_MINIONS` and a `filter` is an aura, read from the villains, the environments and their attachments. New filter key `isFacedown`. The ATK, SCH and hit point loops are merged, and a minion's own hit point constants now count.
  - Ultron III cannot take damage while a Drone minion is in play: `IF_CARD_IN_PLAY` accepts a `filter`.
  - Ultron II's bonus lasts until the end of the attack and follows the attacked player's Drone count: new `duration: ATTACK`, read when the attack value is needed.
  - "When/After [enemy] attacks you" on an encounter card is resolved by the attacked player, not the first player.
  - An encounter attachment can attach to an environment (`attachTo.host.type: ENVIRONMENT`), and the board shows environments and their attachments.
  - A choice option with its own resource cost asks for payment and pays once. `ENEMY_ATTACKS` accepts `engagedWith: SELF`. `THREAT_PLACED` carries its source and scheme.
