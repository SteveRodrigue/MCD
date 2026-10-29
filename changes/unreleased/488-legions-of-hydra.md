---
type: Fixed
---

- **Fix (Data & Engine): Legions of Hydra (01180) When Revealed search and threat ([Issue #488](https://github.com/SteveRodrigue/MCD/issues/488))**
  - Route searched minions with destination `TABLEAU` into `player.engagedMinions` with toughness application and `MINION_ENTERS_PLAY` trigger dispatch.
  - Support `extParam.target` in `ENTITY_COUNT` dynamic formula calculations to evaluate villains and engaged minions against card filters.
  - Verify Legions of Hydra When Revealed resolution against 0, 1, and multiple Hydra enemies in play and promote supplemental confidence to 100%.
