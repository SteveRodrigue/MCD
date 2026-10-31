---
type: Fixed
---

- **Fix (Data & Engine): Integrated The Doomsday Chair modular encounter set ([Issue #356](https://github.com/SteveRodrigue/MCD/issues/356), [Issue #262](https://github.com/SteveRodrigue/MCD/issues/262))**
  - Added `CHARACTER_WOULD_BE_DEFEATED` trigger to schema primitives, schema definitions, and specifications.
  - Implemented character defeat replacement interrupt in `damage-pipeline.ts` for minion defeat windows, cleanly aborting defeat when damage is healed.
  - Fixed attachment host resolution in `attachment-host.ts` and `villain-phase.ts` to discard unattached encounter cards when host criteria fail without fallback per RR v1.8 *Attach To*.
  - Fully modeled Biomechanical Upgrades (`01185`) with `attachTo` host selection and defeat replacement interrupt, removing its ambiguity file.
  - Added comprehensive test coverage in `the-doomsday-chair-encounter.test.ts` for all 3 cards (`01183`, `01184`, `01185`) and verified full match simulation with Rhino.
