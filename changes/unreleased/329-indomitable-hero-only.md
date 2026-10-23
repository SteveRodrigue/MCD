---
type: Fixed
---

- **Fix (Data): Indomitable only readies your hero when your hero defends ([Issue #329](https://github.com/SteveRodrigue/MCD/issues/329), [Issue #334](https://github.com/SteveRodrigue/MCD/issues/334))**
  - `01082` now filters `ATTACK_DEFENDED` on `targetPlayerScope: SELF` and `defenderType: HERO`, so an ally or another player's hero defending no longer triggers it.
  - A data guard requires every `ATTACK_DEFENDED` ability to declare both keys. The Response has no resource cost (the printed 1 is the play cost), pinned by a prompt test.
