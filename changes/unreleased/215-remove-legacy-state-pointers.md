---
type: Changed
---

- **Refactor (Engine): Remove the deprecated `GameState.villain` / `GameState.mainScheme` pointers ([Issue #215](https://github.com/SteveRodrigue/MCD/issues/215), AUD-20261017-232534 R13)**
  - `villains[]` / `mainSchemes[]` are the only representation; the active entries are read through `getActiveVillain` / `getActiveMainScheme`.
  - Deleted the pointer syncs in `setActiveVillain`, `replaceVillain`, `removeVillain`, `replaceActiveMainScheme` and `updateGameState`, and the pointer fallbacks in the accessors and `getVillainById` / `getMainSchemeById`.
  - Migrated about 125 test files to the accessors and removed the obsolete pointer guard test.
