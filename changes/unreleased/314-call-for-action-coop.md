---
type: Added
---

- **Feature (Engine & UI): "Call for Action" in multiplayer cooperative play & encounter/scheme action discovery ([Issue #314](https://github.com/SteveRodrigue/MCD/issues/314))**
  - Removes artificial active-turn blocker in `canInitiateAbility` during `PLAYER_PHASE` per RR v1.8 p. 5 (Action) allowing players to trigger action abilities during other players' turns by request, while enforcing that action abilities on obligations in other players' play areas cannot be triggered.
  - Updates `state-validator.ts` (`getAllCardInstances`, `removeCardFromAllZones`, `findInPlayCardInstance`) to index `state.environments`, `player.obligations`, `state.sideSchemes`, and `player.engagedMinions` so encounter targets can be found and resolved by `USE_CARD_ABILITY`.
  - Extends `legal-actions-generator.ts` with dedicated `callForActionItems` and `villainActionItems` categories, with `ownerName` attribution for teammate tableau cards and single-source enumeration.
  - Updates `TopBar.tsx` with dedicated "CALL FOR ACTION! [N]" and "VILLAIN ACTIONS! [N]" comic badges opening the Daily Bugle action dispatch.
  - Enhances `DailyBugleActionNewspaper.tsx` with Section 4 ("🚨 VILLAIN DISPATCHES: ENCOUNTER & SCHEME ACTIONS") and Section 5 ("🤝 CALL FOR ACTION: TEAM TABLEAU ASSETS") with teammate badges and action execution shortcuts.
  - Updates `HeroZone.tsx` to enable teammate tableau abilities during `PLAYER_PHASE` with cooperative `'🤝 CALL / USE'` indicators.
