---
type: Changed
---

- **Change (Engine): The card catalog is injected into the engine ([Issue #275](https://github.com/SteveRodrigue/MCD/issues/275), AUD-20261017-232534 F014-B)**
  - `setupGame` takes `catalog: CardRepository` and keeps it by reference in `state.options.catalog`; `cloneGameState` does not copy it. The engine reads cards with `getCatalog(state)` and no longer imports the `cardCatalog` singleton (ADR-0087).
  - A test runs the engine on a fake repository, including a scenario that is only a `definition.json` (no subclass), set up and advanced through a stage. ADR-0033 addendum and the Rhino README describe the packaging, which closes #275.
