---
type: Fixed
---

- **Fix (Engine): Pause on star boost cards during scheme activations in step-through mode ([Issue #527](https://github.com/SteveRodrigue/MCD/issues/527))**
  - Wire `pauseBefore` into villain and minion scheme activations when `villainPhaseStepping` is enabled.
  - Symmetrically resume paused scheme activations and place threat after boost reveal prompts resolve.
