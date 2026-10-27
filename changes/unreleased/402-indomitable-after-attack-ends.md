---
type: Fixed
---

- **Fix (Engine): "After your hero defends" responses resolve after the attack has ended ([Issue #402](https://github.com/SteveRodrigue/MCD/issues/402))**
  - Indomitable `01082` and Counter-Punch `01077` are now offered after the forced after-attack abilities (Retaliate, end-of-attack effects such as Charge, forced responses) have resolved, per Rules Reference v1.8 Defend and Attack step 6.
  - The hero and ally Retaliate code in the combat pipeline now shares one helper.
