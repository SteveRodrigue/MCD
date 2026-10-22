---
type: Fixed
---

- **A forced ability that names a scheme is no longer skipped by the target check (#368)**
  - The legality gate judges a named scheme (`MAIN_SCHEME`, `SIDE_SCHEME`, `ALL_SCHEMES`) only for `REMOVE_THREAT`, where Crisis and Patrol apply (#331). Other effects on a named scheme need no valid target.
  - Removed two orphan supplemental entries (`01194`, `01195`) that matched no card, and added a guard that every supplemental entry has an upstream card.
