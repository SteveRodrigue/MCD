---
type: Fixed
---

- **Fix (Engine): a forced choice no longer ends with every option disabled ([Issue #431](https://github.com/SteveRodrigue/MCD/issues/431))**
  - Revealing *Family Emergency* while the identity was already exhausted and stunned disabled both options ("Identity is already exhausted", "No valid target") and the game could not go on. Option availability now applies the "no valid target" rule only among options the player can take at all; if none of those has a valid target, none is disabled and the choice resolves as much as it can (`prompt-queue.ts`). Found by the new simulation Gauntlet.
