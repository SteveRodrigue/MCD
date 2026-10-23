---
type: Fixed
---

- **Fix (Engine): Manual villain phase no longer skips steps after a decision ([Issue #333](https://github.com/SteveRodrigue/MCD/issues/333))**
  - Answering the last clean-up prompt started the phase and then advanced it a second time, so the threat step was passed and the first attack resolved on its own. A stepped phase now waits for the stepper after any decision, including a reveal interrupt such as Black Widow.
  - Removed the dead stepping branch of `continueVillainPhase` and the `hadPausedThreatPlacement` argument of `resumeVillainPhaseAfterDecision`.
