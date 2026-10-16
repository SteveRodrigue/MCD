---
type: Fixed
---

- **Fix (Engine): Dash (–) power values can no longer be used or modified ([Issue #316](https://github.com/SteveRodrigue/MCD/issues/316))**
  - Hulk (01050, THW –) no longer loads as THW 1: it cannot exhaust to thwart, and +THW effects such as Inspired leave its THW at 0 (RR v1.8 "Dash (Value)").
  - The card loader records printed dashes (`null` upstream) in a new `dashPowers` field for heroes, alter-egos, allies, villains and minions; an omitted value is not a dash.
  - Basic attack, thwart and recover legality reject a dash power, and effective stats force a dash power to an unmodifiable 0.
  - The legal-action list no longer offers Ally Thwart without checking legality, and the simulation bot skips ally actions that would be rejected.
  - The ally panel and ally action modal show `–` for a dash power and disable its button.
