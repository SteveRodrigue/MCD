---
type: Fixed
---

- **Fix (UI): Suppress premature turn-end modal during response prompts and hero readies ([Issue #310](https://github.com/SteveRodrigue/MCD/issues/310))**
  - Updated `GameBoard.tsx` to automatically dismiss `EndTurnConfirmationModal` whenever `legalReport.activeActionCount > 0`.
  - Suppressed opening `EndTurnConfirmationModal` when an optional or forced decision prompt is pending (`!decisionPrompt`), preventing turn pass prompts from interrupting abilities like She-Hulk's One-Two Punch (`01024`).
  - Preserved the pre-prompt active action count reference across active decision prompts so that resolving a prompt with "pass" or decline correctly prompts to end turn if zero legal actions remain.

