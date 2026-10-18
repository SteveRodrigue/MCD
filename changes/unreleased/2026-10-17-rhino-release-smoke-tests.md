---
type: Added
---

- **Test (UI): Rhino release smoke suite and honest coverage (AUD-20261017-232534 F007)**
  - One App-level test per Core hero drives the release path: scenario selection, Rhino Standard or Expert, mulligan (with Black Panther's Foresight choice), board, first end of turn up to the clean-up prompt.
  - New Wakanda Forever! modal test: every upgrade Special is listed, the last one is the finisher, and the player's order is executed.
  - `coverage.include` lists every `src` file, so files no test imports appear at 0 % instead of being left out. Statement coverage reads 82.4 %; App 72 %, ScenarioSelector 78 %, MulliganScreen 53 %, WakandaForeverModal 70 % (were absent or 4.65 %).
