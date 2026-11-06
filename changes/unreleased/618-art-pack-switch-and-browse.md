---
type: Added
---

- **Feature (UI): Switch art packs on or off and browse their artwork ([Issue #618](https://github.com/SteveRodrigue/MCD/issues/618))**
  - The Options menu and the Content screen list every art pack with its name, description, credit and image count, an on/off switch and a Browse button. The choice is saved in the browser and applies at once.
  - Browse shows every image of a pack with the card name, code and printed stats, with a filter and an enlarged view.
  - `art-pack.json` now requires a `description`. The loader warns about a listed image that is missing from the pack folder and does not use it.
