# Content

Everything the game loads at runtime lives here, organised in packs (see ADR-0092).

- `packs/<code>/` is one pack: `pack.json`, `cards/`, `supplemental/`, `translations/`, and where it applies `scenarios/`, `decks/` and `modular-sets.json`.
- `packs/<code>/scripts/index.ts` is the code an official pack needs beyond its JSON (the Core pack's Wakanda Forever handler). It default-exports the pack's hooks; `npm run schema:generate` lists every pack with scripts in `src/data/content/pack-hooks.generated.ts`, and `pack:validate` fails a pack that is missing from it. User packs are JSON-only.
- `meta/` holds the catalog data shared by all packs (pack, set and faction lists, JSON schemas, catalog translations).
- `config.json` lists the packs the game loads (`enabledPacks`); their dependencies are added automatically. A pack that is not listed stays on disk but is not loaded.
- `packs/<code>/assets/cards/<file>.png` is art a pack ships for its own cards.
- `.cache/` is disposable and git-ignored: `upstream/` (sync download) and `images/<code>/` (card art fetched on demand from MarvelCDB, plus `images/_backs/`). `npm run cache:cards [-- --pack <id>]` fills it ahead of time.

Check the tree with `npm run pack:validate -- content/packs` and see which packs have supplemental data with `npm run pack:status`.

Refresh `cards/`, `meta/` and `translations/` from upstream with `npm run content:sync` (`-- --check` to preview); it never touches `pack.json` or `supplemental/`.
