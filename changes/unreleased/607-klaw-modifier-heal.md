---
type: Fixed
---

- **Fix (Data): Klaw villain-modifier and heal cards ([Issue #607](https://github.com/SteveRodrigue/MCD/issues/607))**
  - Added audited supplemental declarations for Solid-Sound Body (`01119`) with CONSTANT Retaliate 1 grant and Hero Action discard cost.
  - Added audited supplemental declarations for Sound Manipulation (`01124`) with Alter-Ego heal/surge branching and Hero form damage and heal.
  - Added targeted test coverage in `tests/engine/klaw-modifier-heal-607.test.ts`.
  - Added fixture fallbacks in simulation stage-setter when 100% of cards of a type (e.g. treacheries) define abilities.
