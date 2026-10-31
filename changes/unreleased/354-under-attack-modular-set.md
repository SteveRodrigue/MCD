---
type: Fixed
---

- **Fix (Data & Engine): Integrated Under Attack modular encounter set ([Issue #354](https://github.com/SteveRodrigue/MCD/issues/354))**
  - Added `forEachPlayer: true` to Under Attack (`01151`) to prompt each player sequentially to choose threat or hero damage.
  - Enabled generic `DAMAGE_TAKEN` trigger dispatch on villain damage in `damage-pipeline.ts` and stage-setter simulation scenarios.
  - Extended `scanInPlayTriggerAbilities` in `trigger-dispatcher.ts` to scan attachments on villains for triggers.
  - Fully modeled Vibranium Armor (`01152`) with Forced Response and Hero Action discard, removing its ambiguity file.
  - Implemented `ALL_FRIENDLY_CHARACTERS` damage selector in `damage.ts` and verified Concussive Blast (`01154`) reveal and boost effects.
  - Added full test coverage across all 4 cards and verified Rhino simulation with the Under Attack modular set.
