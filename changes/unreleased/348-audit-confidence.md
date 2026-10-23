---
type: Fixed
---

- **Data: Record `audit.confidence` for Usurp The Throne (`01156`) and Vulture (`01167`) ([Issue #348](https://github.com/SteveRodrigue/MCD/issues/348))**
  - Both `noSupplementalNeeded` entries now carry confidence 100 (no printed rules text beyond the Hazard icon; Quickstrike read from the upstream keyword).
  - A schema test now requires every supplemental entry to record `audit.confidence`.
