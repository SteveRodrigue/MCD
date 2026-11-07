---
type: Added
---

- **Feature (UI): Art packs tied to heroes ([Issue #664](https://github.com/SteveRodrigue/MCD/issues/664))**
  - An art pack can list `heroes` (hero card codes). It then shows only on cards owned by a seat whose hero is listed, in the game, the mulligan screen and the setup preview. Packs with no `heroes` work as before.
  - The pack list and Browse show "For: <heroes>"; the loader warns about an unknown or non-hero code. See ADR-0093 decision 16 and the art packs creator guide.
