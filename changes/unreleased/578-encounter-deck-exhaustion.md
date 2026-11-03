---
type: Fixed
---

- **Fix (Engine): Reset empty encounter deck immediately per RR v1.8 ([Issue #578](https://github.com/SteveRodrigue/MCD/issues/578))**
  - Drawing or shifting the final card from the encounter deck immediately resets it from discard and increments the main scheme acceleration tokens.
  - Export `checkAndResetEncounterDeck` helper mirroring player deck reset logic.
  - Deal surge cards before routing treacheries to discard so the surging card does not reshuffle into the new deck.
