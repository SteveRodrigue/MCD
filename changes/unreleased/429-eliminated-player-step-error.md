---
type: Fixed
---

- **Fix (Engine): Resolve ability steps cleanly when a hero is eliminated ([Issue #429](https://github.com/SteveRodrigue/MCD/issues/429))**
  - Ability sequences (`executeSequence`, `executeForEachPlayer`) now halt when `state.winner` is set instead of executing subsequent steps on a terminated game.
  - Step execution (`executeStep`, `executeDiscard`) allows fallback lookup of eliminated players so conditional post-attack steps (such as Stampede `01106`'s `ADD_STATUS`) resolve missing targets cleanly without an `engine.stepError`.
  - Added unit test coverage for solo and multiplayer hero elimination during multi-step encounter abilities in `tests/engine/player-elimination.test.ts`.
