---
type: Fixed
---

- **Fix (Engine): A defeat ability with no scope reacts only to its controller ([Issue #363](https://github.com/SteveRodrigue/MCD/issues/363))**
  - `DEFEATED` and `CHARACTER_DEFEATED` abilities without `targetPlayerScope`, `defeatedByAttackOf` or `targetScope` no longer fire for another player's defeat; `targetPlayerScope: ANY` opts out.
  - The damage and defeat defaults share one check (`failsImplicitControllerScope`); ADR-0020 addendum and the trigger spec document it.
