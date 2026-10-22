---
type: Fixed
---

- **Fix (Engine): Crisis, Patrol and Guard are decided in one place, so no way to remove threat can disagree with another ([Issue #331](https://github.com/SteveRodrigue/MCD/issues/331))**
  - Legal Practice (`01023`) was offered the main scheme although an icon prevented it. The "player cards cannot remove threat from the main scheme" rule was written eight times (executor, two target enumerations, hero and ally thwart, event play, ability use); it now lives in `target-restrictions.ts` and the `REMOVE_THREAT` rule of the legality gate (ADR-0090 addendum).
  - `canBasicAttack`/`canAllyAttack` and `canBasicThwart`/`canAllyThwart` are merged into `canAttack` and `canThwart`; one action-window check replaces six pasted copies. The gate also judges `MAIN_SCHEME`, `SIDE_SCHEME` and `ALL_SCHEMES` and ignores steps whose state gate is closed.
  - Guard tests: Crisis, Patrol and Guard may only be read in the restriction module; a parity test asks the hero thwart, ally thwart, an event, an ability and the thwart executor about the same boards.
