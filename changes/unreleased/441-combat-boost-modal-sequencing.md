---
type: Fixed
---

- **Fix (UI): Show combat boost and damage summary before post-defense reactions ([Issue #441](https://github.com/SteveRodrigue/MCD/issues/441), Refs [#402](https://github.com/SteveRodrigue/MCD/issues/402))**
  - When an enemy attack resolves with a post-defense reaction (such as Counter-Punch `01077` or Indomitable `01082`), `CombatBoostModal` is no longer blocked by the pending reaction prompt.
  - The combat boost summary displaying revealed boost cards and damage calculations renders first.
  - Dismissing the boost summary cleanly presents the decision prompt modal without prematurely advancing the villain phase.
