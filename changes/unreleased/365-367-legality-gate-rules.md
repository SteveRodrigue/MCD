---
type: Fixed
---

- **Fix (Engine): The legality gate judges every effect and every target selector ([Issue #365](https://github.com/SteveRodrigue/MCD/issues/365), [Issue #367](https://github.com/SteveRodrigue/MCD/issues/367))**
  - Eight effects that were "always valid" now have a target-state rule shared with their handler: `ADD_THREAT` (a named scheme must be in play: Yon-Rogg's Forced Response is skipped while the Psyche-Magnitron is absent), `ADD_TRAIT`, `DISCARD`, `PUT_INTO_PLAY`, `REMOVE_COUNTERS`, `REMOVE_COUNTERS_MATCHING_FILTER`, `REMOVE_STATUS` and `RETURN_TO_HAND`. Highway Robbery's Forced Response needs cards underneath, and Hellcat or Make the Call needs the source in play.
  - Fixed and group selectors (`VILLAIN`, `MAIN_SCHEME`, `ALL_HEROES`, `ALL_MINIONS`, ...) and `CHOSEN_PLAYER` are judged like chosen ones: a group is valid while one member can be affected. The per-effect allow-list for named selectors (#368) is deleted.
  - A step judged only by its own params decides the ability when it is the only judged step, so a spare discard never excuses a thwart with nothing to thwart.
