---
type: Removed
---

- **Removed (Code): Unused exports and alias wrappers (AUD-20261017-232534 F017)**
  - Deleted 27 exports that nothing referenced, among them `ActionType` (replaced by `GameAction`), `getActivePlayer`, `registerPrebuiltDeck`, `preloadCardArts`, `getAllSpecialHandlers`, `defaultShuffle`, `getAllowedEffectParamKeys` and unused schema param types.
  - Removed the `FilterSchema` alias of `UniversalCardFilterSchema` (the `matchCardFilter` alias went with F008).
  - 75 functions and constants used only inside their own file are no longer exported. Exported types stay: they name the parts of public contracts such as `GameAction` and `GameState`.
