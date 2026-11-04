---
type: Added
---

- **Feature (UI, Data): Optional local art packs for any card ([Issue #613](https://github.com/SteveRodrigue/MCD/issues/613), [Issue #552](https://github.com/SteveRodrigue/MCD/issues/552))**
  - Images in the gitignored `content/art-packs/<id>/` folder replace a card's art wherever it is drawn, except in the Card Editor. With no art pack, the game looks as it did before.
  - A card can list several images with printed stats, and the image follows its current stats. Ultron Drone tokens switch from Mk. I to Mk. IV as Ultron III and Upgraded Drones arrive and leave.
  - A broken image falls back to the official art or the labelled card back. The Content screen lists art packs, their credit and any problems.
  - Ultron's Drone stats now live in the scenario's `definition.json`.
