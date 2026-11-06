---
type: Added
---

- **Feature (UI): Switch art packs on or off and browse their artwork ([Issue #618](https://github.com/SteveRodrigue/MCD/issues/618))**
  - The Options menu and the Content screen list every art pack with its name, description, credit and image count, an on/off switch and a Browse button. The choice is saved in the browser and applies at once.
  - Browse shows every image of a pack with the card name, code and printed stats, with a filter and an enlarged view.
  - `art-pack.json` now requires a `description`. The loader warns about a listed image that is missing from the pack folder and does not use it.
  - Hero and alter-ego art is proved with a full fan-made pack: every identity card has its image, and both faces of each hero load when the game starts, so the first form change has no wait.
  - A card from an installed pack that is off is no longer reported as a problem. Browse names it and marks it "pack off", and the filter finds it. Only a code in no installed pack gets a warning.
