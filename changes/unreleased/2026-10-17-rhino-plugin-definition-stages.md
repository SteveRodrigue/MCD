---
type: Changed
---

- **Change (Engine): The Rhino plugin reads its stages from `definition.json` (AUD-20261017-232534 F011-B)**
  - Villain stage progression (Skirmish I; Standard I then II; Expert II then III) and the encounter-deck exclusions come from the scenario definition instead of hard-coded card codes. The victory log keeps the `scenario.victory` key with the difficulty and villain name.
  - Removed hooks the engine never called: `evaluateWinLossConditions` (Rhino plugin and `ScenarioPlugin`) and `onVillainPhaseStep1/2` (`ScenarioPlugin`).
