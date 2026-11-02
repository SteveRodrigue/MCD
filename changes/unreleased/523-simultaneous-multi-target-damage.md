---
type: Fixed
---

- **Fix (Engine): Multi-target damage resolves simultaneously across all targets ([Issue #523](https://github.com/SteveRodrigue/MCD/issues/523), [Issue #525](https://github.com/SteveRodrigue/MCD/issues/525))**
  - Resolves RR v1.8 9-step damage sequence across all targets together in lockstep so "after takes damage" triggers fire only after all targets have received damage and "would be defeated" interrupt windows see fellow targets still in play.
  - Unifies `ALL_CONTROLLED_CHARACTERS` resolution across distribution and damage handlers to include the controller's identity and their allies only.
