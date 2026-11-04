---
type: Fixed
---

- **Fix (Data): Klaw encounter set scanned ([Issue #351](https://github.com/SteveRodrigue/MCD/issues/351))**
  - Completed supplemental declarations for all 16 core encounter cards in the Klaw set (across subtasks #604, #605, #606, #607).
  - Promoted `'klaw'` to `scannedEncounterSets` in `tests/data/card-loader.test.ts`.
  - Removed piecemeal individual card overrides from `scannedEncounterCards`.
