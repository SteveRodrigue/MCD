---
type: Fixed
---

- **Fix (UI): No delayed state updates after a component closes (AUD-20261017-232534 F020)**
  - A new `useTimeout` hook cancels pending callbacks on unmount. The toasts and "copied" flags of the options menu, the hand tray, the card context menu and the Card Editor inspector use it instead of bare `setTimeout`, which could update a closed component.
  - `HeroZone` and `FacedownEncounterCard` read settings through `useOptionalGameSettings()` instead of calling a hook inside `try/catch`.
