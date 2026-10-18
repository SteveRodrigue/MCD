---
type: Changed
---

- **Change (Engine): An effect without a handler fails loudly (AUD-20261017-232534 F010-C)**
  - `executeStep` used to answer any effect it did not handle with success, so a missing handler looked like a resolved no-op. Its `default` now throws and is exhaustive at compile time over the schema's effect list.
  - The constant effects read elsewhere (`MODIFY_HAND_SIZE`, `MODIFY_MAX_HEALTH`, `CANNOT_TAKE_DAMAGE`, `DOUBLE_RESOURCE_FOR_ASPECT`, `MODIFY_ALLY_LIMIT`, `MODIFY_RESTRICTED_LIMIT`) are explicit no-op cases.
  - A decision-prompt option whose `effect` is a routing marker (`PASS`, `CANCEL_PLAY`, `RESOLVED`, ...) now runs no step instead of a fake one; `isEffectType` tells the two apart.
  - Removed the unused `'END_TURN' as any` alias of `END_PLAYER_TURN`. Two tests that relied on invented effects (`DISCARD_ALLY`) were corrected.
