---
type: Added
---

- **Test tooling (Engine): five more rule scenarios and three remaps for the simulation ([Issue #472](https://github.com/SteveRodrigue/MCD/issues/472))**
  - New rule scenarios for Guard (the villain attack is refused), Max 1 per player (the second copy cannot be played), Quickstrike, Permanent (starts in play, not in the deck) and consequential damage (an ally takes its ATK-icon damage after attacking). Observed rules rise from 135 to 143 of 257.
  - Engage, Move and Excess Damage now map to log keys the runs already write (`encounter.reveal.minion`, `damage.transferred`, `overkill.hit`) instead of being declared unobservable.
