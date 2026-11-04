---
type: Fixed
---

- **Fix (Engine, Data): Ultron's Drones keep the player's real card ([Issue #352](https://github.com/SteveRodrigue/MCD/issues/352))**
  - A Drone is now a minion shell ("Drone", SCH 1 / ATK 1 / HP 1) with the real deck card tucked under it. When it is defeated or discarded, the real card goes to its owner's discard pile instead of a fake card going to the encounter discard. The shell is removed, not piled (`CardInstance.isShell`).
  - Every creator card makes Drones through one script action: `EXECUTE_SPECIAL` with `specialId: "ULTRON_DRONE"` and the new params `target` (`SELF`, `ALL_PLAYERS`, `FIRST_PLAYER`, `ENGAGED_PLAYER`) and `count`. New data for The Crimson Cowl 1B, Assault on NORAD 2A, Countdown to Oblivion 3A, Ultron Drones, Advanced Ultron Drone, Android Efficiency (When Revealed) and Ultron's Imperative.
  - An empty deck runs out as usual before the Drone is taken, instead of skipping the player. A real card reaching a discard pile also completes a deck exhaustion that was waiting for one.
  - An eliminated player's Drones leave play, and their real cards go to that player's discard pile (Player Elimination step 4).
  - The board shows a Drone as a card back labelled "Drone", and the real card stays hidden.
  - Removed the `ScenarioHooks` contract and its only hook `resolveStage1BReveal`, and the unused `SpecialAbilityHandler.validatePlayCondition`. The log key `scenario.setup.drone` is now `minion.drone.created`.
