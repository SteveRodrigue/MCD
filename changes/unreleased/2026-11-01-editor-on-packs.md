---
type: Changed
---

- **Change (Editor): The Card Supplemental Editor works on packs (M9)**
  - The editor lists the cards of the packs the game loaded, with a new Content Pack filter that shows each pack's origin, and no longer has an API of its own.
  - Save writes `content/packs/<id>/supplemental/<file>.json` for `user` and `official-bundled` packs (Core stays editable during development) through one guarded `PUT` on the dev server's content endpoint. Synced packs open read-only.
  - Reload the game page to play with a saved change.
