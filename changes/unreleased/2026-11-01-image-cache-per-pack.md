---
type: Changed
---

- **Change (Content): Card art is cached per pack in `content/.cache/images/<pack>/` (M6)**
  - Art is served at `/card-art/<packId>/<file>.png`: the art a pack ships in `assets/cards/` first, then the cache, then (official packs only) a download from MarvelCDB. The three card backs are in `content/.cache/images/_backs/`.
  - A pack declares swapped main scheme art sides with `art.swapMainSchemeSides` in `pack.json` (Core does); the card-code prefix check is gone.
  - `npm run build` no longer copies cached card art into `dist/`; official art is never part of build output.
  - `npm run cache:cards` caches every enabled pack (`-- --pack <id>` for one) through the same code as the dev server.
  - The old root `cache/` folder is no longer read and is not deleted; move `cache/cards/*` for Core cards into `content/.cache/images/core/` to skip a refetch, or delete it.
