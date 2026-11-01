# Content

Everything the game loads at runtime lives here, organised in packs (see ADR-0092).

- `packs/<code>/` is one pack: `pack.json`, `cards/`, `supplemental/`, `translations/`, and where it applies `scenarios/`, `decks/` and `modular-sets.json`.
- `meta/` holds the catalog data shared by all packs (pack, set and faction lists, JSON schemas, catalog translations).
- `config.json` lists the packs the game loads (`enabledPacks`); their dependencies are added automatically. A pack that is not listed stays on disk but is not loaded.
- `.cache/` is disposable and git-ignored.

Check the tree with `npm run pack:validate -- content/packs` and see which packs have supplemental data with `npm run pack:status`.

Refresh `cards/`, `meta/` and `translations/` from upstream with `npm run content:sync` (`-- --check` to preview); it never touches `pack.json` or `supplemental/`.
