---
type: Fixed
---

- **Organized Play Per-Hero Art Packs**: Bound all 8 Organized Play 2020 promo resource art packs (`op_resources_*`) to their respective hero codes (`heroes` manifest field) so a multiplayer game displays each player's own hero resource artwork during mulligan and play instead of falling back to `op_resources_blackpanther` globally, prevented unowned encounter cards in a hero's zone from inheriting the seat hero's art pack, and preserved seat hero art context across the Daily Bugle action banner and defeated players in the Removed From Game box ([Issue #669](https://github.com/SteveRodrigue/MCD/issues/669)).
