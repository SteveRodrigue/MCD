---
type: Changed
---

- **Refactor (Engine): Merged duplicated host attachment and card routing ([Issue #332](https://github.com/SteveRodrigue/MCD/issues/332))**
  - `resolveChosenHostAttachment` is one table-driven function for minion, ally and enemy hosts instead of three copied branches.
  - `routeSearchedCards` is folded into `routeCardInstances`, now in `src/engine/effects/card-routing.ts`, which takes a per-card origin.
  - Behavior changes: minion hosts now honor `maxPerHost`; a card from the encounter discard routed to DECK_TOP/BOTTOM/SHUFFLE goes to the encounter deck; the minion and ally host prompts name the controller in the option description.
