---
type: Fixed
---

- **Fix (Engine): Forced abilities resolve before any optional prompt of the same trigger ([Issue #361](https://github.com/SteveRodrigue/MCD/issues/361))**
  - A defeat (or any trigger) no longer resolves a later player's Forced ability while an earlier player's optional Response prompt is pending, and an optional prompt no longer stops a Forced ability listed after it from resolving.
  - Two or more simultaneous Forced abilities are ordered by the first player, whoever controls the cards, with the existing ordering prompt; each resolves completely before the next.
