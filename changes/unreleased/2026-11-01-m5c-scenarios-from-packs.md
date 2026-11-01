---
type: Changed
---

- **Refactor (Engine, Data): Scenarios are loaded from content packs (M5c)**
  - The content loader reads `packs/<id>/scenarios/<scenario>/definition.json` (new `ContentDriver.listDirs`), and `applyContent` builds one `DeclarativeScenarioPlugin(definition, hooks?)` per scenario; `resetContent` clears the registry. The scenario selector lists them by scenario card code (Rhino, Klaw, Ultron).
  - `setupOnomatopoeia` is part of the scenario definition; the three `built-in/` plugin classes and the import-time registration are deleted. Ultron's facedown Drone step is the pack script `content/packs/core/scripts/scenarios/ultron.ts` (`PackHooks.scenarioHooks`).
  - With no pack loaded the scenario screen shows "No scenario available" instead of failing.
