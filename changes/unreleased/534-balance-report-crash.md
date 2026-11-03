---
type: Fixed
---

- **Fix (Engine): Stop trigger scans on game over and prevent crash when no players remain ([Issue #534](https://github.com/SteveRodrigue/MCD/issues/534))**
  - Halt `dispatchTrigger` immediately following forced candidate resolution when `state.winner` is set.
  - Guard `scanEncounterTriggerAbilities` and `damage-pipeline.ts` against calling `getFirstPlayer` when `state.players` is empty.
  - Halt `handleAllyAttack` consequential damage resolution when the match has ended.
  - Support replaying single matches in `scripts/simulate-games.ts` via `--balance --seed <seed>`.
