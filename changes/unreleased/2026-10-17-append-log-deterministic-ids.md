---
type: Changed
---

- **Change (Engine): One log writer and deterministic ids (AUD-20261017-232534 F009)**
  - `appendLog(state, entry)` replaces 197 hand-written `state.log.push(...)` sites in 22 engine files. It fills the id and timestamp from the engine id counter and defaults round and phase to the current ones.
  - Villain, main scheme and prompt ids use `nextEngineId` instead of `Date.now()`; the engine no longer reads the wall clock. Two simulations with the same seed now produce identical states (ADR-0081 addendum).
  - New guards: a seeded replay test and a source scan that rejects `Date.now()` or a direct `log.push` in `src/engine`.
