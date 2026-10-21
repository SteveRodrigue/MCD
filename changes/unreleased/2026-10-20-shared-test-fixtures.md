---
type: Changed
---

- **Chore (Tests): Shared game fixtures and removal of the unused execution stack (audit R14)**
  - Added `tests/support/game-fixtures.ts` (`newRhinoGame`, `dispatchOk`, `heroCard`, `abilityOf`) and migrated the ten heaviest `setupGame` test files to it.
  - Removed the unused `executionStack` / `ExecutionFrame` state and the `pushExecutionFrame` / `peekExecutionFrame` / `popExecutionFrame` helpers; ADR-0032 is amended.
