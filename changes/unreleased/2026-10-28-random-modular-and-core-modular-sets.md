---
title: "Random modular selector option and core modular sets supplemental data"
type: Added
date: "2026-10-28"
---

### Features
- Added "Pick Randomly" (`🎲 Pick Randomly`) option to the modular encounter set dropdown in `ScenarioSelector.tsx`.
- Added house-rule checkbox `[x] Random pick exclude the recommended (house rule)` allowing players to ensure the random roll substitutes the scenario recommendation.
- Added supplemental data definitions in `core_encounter.json` for the remaining Core Set modular sets:
  - Masters of Evil (`01128` to `01133`)
  - Under Attack (`01151` to `01154`)
  - Legions of Hydra (`01180` to `01182`)
  - The Doomsday Chair (`01183` to `01185`)
- Added ambiguity reports in `docs/ambiguities/` for Tier 3 cards (`01130`, `01132`, `01133`, `01182`, `01185`).
- Extended `routeCardInstances` and `DISCARD` (`UNTIL_MATCH`) to support `matchingDestination: 'PLAY'` and minion placement engaged with the designated player.
