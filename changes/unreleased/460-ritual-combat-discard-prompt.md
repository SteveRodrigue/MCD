---
type: Fixed
---

- **Fix (UI & Engine): Clarify discarded cards and evaluated X in decision prompts ([Issue #460](https://github.com/SteveRodrigue/MCD/issues/460))**
  - Evaluated dynamic formulas referencing `DISCARDED_CARDS` during `PLAYER_CHOICE` prompt creation so option labels and descriptions replace abstract variable `X` with resolved numbers (e.g. Ritual Combat `01159`).
  - Added discarded encounter card showcase panel to `DecisionPromptModal` displaying card thumbnail, name, type, and boost icon badge.
