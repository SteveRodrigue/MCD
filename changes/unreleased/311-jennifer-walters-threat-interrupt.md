---
type: Fixed
---

- **Fix (Engine): "I Object!" interrupt (01019b) offered on villain-phase Step 1 threat ([Issue #311](https://github.com/SteveRodrigue/MCD/issues/311))**
  - Scans identity abilities across all players in turn order for `THREAT_WOULD_BE_PLACED` so non-active players with Alter-Ego interrupts (Jennifer Walters `01019b`) are prompted.
  - Includes `THREAT_WOULD_BE_PLACED` in `playersToScanForInPlay` so that in-play cards across all players can react.
  - Keeps villain phase stepper on `MAIN_SCHEME_THREAT` while threat interrupt prompts are open instead of advancing prematurely to activations.
  - Re-evaluates identity interrupt prompt usability so that queued prompts are pruned if the player's active form changes before resolution.

