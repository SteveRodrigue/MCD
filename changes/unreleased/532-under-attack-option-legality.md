---
type: Fixed
---

- **Fix (Engine): Enforce target legality on decision prompt resolution ([Issue #532](https://github.com/SteveRodrigue/MCD/issues/532))**
  - Reject resolution of any prompt option marked disabled by legality checks in `resolveDecisionPrompt`.
  - Pass `sourceCardInstance` and search in-play side schemes during prompt option availability checks.
  - Exclude obligations from `checkOptionTargets` so fallback penalties remain accessible per ADR-0075.
  - Disable "Deal 3 damage to hero" for alter-ego players resolving Under Attack (01151).
