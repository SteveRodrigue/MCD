---
type: Fixed
---

- **Fix (UI): The Content screen shows what each pack is missing and refuses a pack with no supplemental data ([Issue #649](https://github.com/SteveRodrigue/MCD/issues/649))**
  - A pack with no supplemental data is tagged Error and cannot be switched on. A pack with only some, such as Green Goblin, is tagged Incomplete with the count. Each tag is the same whether the pack is on or off.
  - A pack with no image on disk says so ("no images", or "no images downloaded yet" for an official pack). Images never block a pack.
  - A pack listed in `config.json` by hand still loads, so the Card Editor can write its first data.
  - A pack that is on can now always be switched off, including one tagged Failed or Needs pack.
  - `npm run pack:status` adds an images column.
