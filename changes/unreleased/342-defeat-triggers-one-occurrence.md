---
type: Fixed
---

- **Fix (Engine): A minion's defeat is announced after the whole attack resolves, Overkill included ([Issue #342](https://github.com/SteveRodrigue/MCD/issues/342))**
  - A Forced Response to a minion's defeat now resolves after the Overkill damage reaches the villain, with every response in one window (RR v1.8 Triggering Condition).
  - "After you defeat" in-play abilities go to the player whose hero attacked, not to the player the minion was engaged with. Interrogation Room `01063` now uses `defeatedByAttackOf: YOUR_HERO`.
  - Defeating the last villain stage declares victory: pending decisions are cleared and no trigger fires afterwards.
  - New tests for Relentless Assault `01053` with Tough on the minion and on the villain, cross-player targets, several copies of a response in hand, and the Stage I to Stage II double defeat.
