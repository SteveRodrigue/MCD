---
type: Changed
---

- **Change (UI/Engine): Scenario setup reads one source of truth (AUD-20261017-232534 F004)**
  - The setup screen lists scenarios from the `ScenarioRegistry` (`definition.json`) instead of the legacy hard-coded `src/engine/scenarios/catalog.ts`, which is deleted. The subtitle is the stage 1A main scheme name; the villain preview follows the difficulty's first stage.
  - Modular encounter set card counts come from the card catalog (Under Attack now shows 5 cards, not 8). Names and descriptions moved to `src/engine/scenarios/modular-sets.json`.
  - Starting a game passes only the scenario id, difficulty and modular sets to `setupGame`; the scenario plugin builds the villain, main scheme and encounter deck. The Expert setup no longer overwrites Rhino I's hit points on a shared card object, and the UI no longer builds two extra card catalogs.
