---
type: Changed
---

- **Change (Engine): One declarative scenario plugin (AUD-20261017-232534 F011-A)**
  - `DeclarativeScenarioPlugin` builds the villain, main scheme, encounter deck and stage progressions of a scenario from its `definition.json`. Rhino is now a plain instance; Klaw and Ultron subclass it only for stage 1A setup, Klaw II's reveal and Ultron's drones. The three plugins shrink from 919 to 456 lines with no behaviour change.
  - Main scheme stages, encounter sets and excluded cards come from the definition and the card data instead of hard-coded codes and fallback numbers.
