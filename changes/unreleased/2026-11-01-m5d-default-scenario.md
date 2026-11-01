---
type: Changed
---

- **Refactor (Engine): No hard-coded Rhino default (M5d)**
  - `defaultScenarioId()` (lowest scenario card code) replaces the `'rhino'` literals and the `01094`/`01097b` fallbacks in game setup; a scenario with a missing villain or main scheme is a setup error, and no registered scenario is a clear error.
  - `GameState.scenarioId` is required; the scenario selector opens on the first available scenario; the simulation and Gauntlet take the scenario explicitly; prebuilt deck file names use the pack code.
