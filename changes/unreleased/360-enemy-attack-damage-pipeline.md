---
type: Fixed
---

- **Fix (Engine): Enemy Overkill on a defeated ally respects Tough and damage shields ([Issue #360](https://github.com/SteveRodrigue/MCD/issues/360))**
  - The excess goes to the ally's controller through `applyDamageToTarget` (`sourceType: 'OVERKILL'`): a Tough status card prevents it and is discarded, a damage shield absorbs it.
  - The "would be taken" interrupt window for that excess is the separate issue [#389](https://github.com/SteveRodrigue/MCD/issues/389).

- **Fix (Engine): Enemy attack damage to heroes and allies uses the damage pipeline ([Issue #269](https://github.com/SteveRodrigue/MCD/issues/269))**
  - `applyCalculatedAttackDamage` builds one request and calls `applyDamageToTarget`; its hand-written Tough, Piercing, health, defeat and discard code is gone.
  - A defending ally now uses its damage shields, and a defeated ally follows the Victory-display rule.
  - Defeats of an enemy attack name the attacker (`defeatSource.instanceId`); the defeats of one occurrence are announced in order (ally then identity, minion then villain) after every state change.
  - Log: `overkill.hit` replaces `overkill.villain.hit`; `damage.tough.pierced` and `ally.defeated` come from the pipeline; `ally.attack.hit`, `ally.tough.absorbed`, `hero.tough.absorbed` and the two `*.piercing.tough.discarded` keys are removed.
