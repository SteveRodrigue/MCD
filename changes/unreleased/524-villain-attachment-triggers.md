---
type: Fixed
---

- **Fix (Engine): Scan in-play encounter card triggers independently of player loop ([Issue #524](https://github.com/SteveRodrigue/MCD/issues/524))**
  - Extract card ability scanning in `trigger-dispatcher.ts` into a reusable helper.
  - Decouple encounter cards from the per-player loop so villain attachments (e.g. Vibranium Armor) trigger when damaged by non-first players.
