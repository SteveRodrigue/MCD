---
type: Fixed
---

- **Fix (Engine): Ending the game clears all in-flight resolution state ([Issue #362](https://github.com/SteveRodrigue/MCD/issues/362))**
  - One `endGame(state, winner)` helper replaces `declareVictory` and the three direct `state.winner = 'VILLAIN'` assignments; it is the only writer of `state.winner`.
  - Clears pending placements, activations, clean-up, boost, attack and encounter context for a HEROES or VILLAIN win.
  - Attack damage that ends the game skips the post-attack reactions, Retaliate and clean-up.
