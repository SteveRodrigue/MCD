---
type: Fixed
---

- **Fix (Engine): Crisis and Patrol now stop every threat removal from the main scheme ([Issue #370](https://github.com/SteveRodrigue/MCD/issues/370), [#371](https://github.com/SteveRodrigue/MCD/issues/371), [#372](https://github.com/SteveRodrigue/MCD/issues/372))**
  - The block lives in `removeThreatFromScheme`, so a distributed threat removal (`DISTRIBUTE_AMOUNT`) obeys it like a thwart; the distribution prompt no longer offers a shielded main scheme.
  - One scheme enumeration for the resolver and the eligible targets (the main scheme has one id everywhere), and one `firstChosenTargetStep` decides which step needs a target prompt for the gate, abilities and events.
  - The two copies of the distribution application and the two prompt-label builders are merged.
