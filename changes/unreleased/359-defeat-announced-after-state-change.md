---
type: Fixed
---

- **Fix (Engine): A villain or hero defeat is announced after its state change ([Issue #359](https://github.com/SteveRodrigue/MCD/issues/359))**
  - A Response to the defeat of a villain stage now sees the next stage in play at full hit points; a Response to a hero defeat sees the hero eliminated. Ally and minion defeats from ally attack, ally thwart and a lost hit point bonus are announced after the discard. One enemy attack that defeats an ally and, by Overkill, the hero announces both after both state changes.
  - `dispatchDefeat` moves to `triggers/defeat-dispatch.ts` and the side scheme defeat uses it (no second dispatcher). A hero defeat is `targetType: 'HERO'` everywhere (the pipeline said `'PLAYER'`).
