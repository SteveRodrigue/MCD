---
type: Fixed
---

- **Fix (Engine): The 100-game simulation plays real rounds (AUD-20261017-232534 F001)**
  - `runMatch` dispatched every bot action except `END_PLAYER_TURN` and ran its own phase loop, so heroes never discarded, drew up to hand size or readied after round 1 (last gate run: 3.3 rounds and 7.6 actions per game).
  - The simulator now dispatches `END_PLAYER_TURN` and lets the engine run clean-up, the villain phase and round upkeep; it fails fast if the game is not back in the player phase. Gate run after the fix: 100/100 games complete, 4.8 rounds and 19.6 actions per game, 0 invariant violations.
  - New tests assert the clean-up draw before round 2 and a minimum number of actions over 5 rounds.
