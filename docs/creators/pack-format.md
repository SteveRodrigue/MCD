# Pack format

A pack is a folder `content/packs/<id>/`. The game loads the packs listed in `content/config.json` (`enabledPacks`) plus whatever they depend on. [ADR-0092](../decisions/0092-content-packs-and-runtime-loading.md) records why.

## Folder layout

```text
content/packs/<id>/
  pack.json                 required, described below
  cards/*.json              card data, zzorba format; one array of cards per file
  supplemental/*.json       rules data per card; see supplemental-reference/
  scenarios/<scenario>/     definition.json for each scenario (see scenarios.md)
  modular-sets.json         modular encounter sets the pack adds
  decks/*.json              starter decks
  translations/             localized card text
  assets/cards/<file>.png   art the pack ships for its own cards
  scripts/index.ts          official packs only, never in a user pack
```

Every part except `pack.json` is optional. A pack with cards and no `supplemental/` is shown as **Data only**; with supplemental data it is **Playable**. A pack whose `dependsOn` pack is missing is **Needs pack**, and a pack that fails validation is **Failed** with the reason on the Content screen.

## pack.json

Validated by `PackManifestSchema` (`src/data/packs/pack-manifest.ts`). Unknown properties are rejected.

| Property     | Required | Meaning                                                                                                                                                                                                         |
| ------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$schema`    | no       | Editor hint for JSON completion. Ignored by the game.                                                                                                                                                           |
| `id`         | yes      | Lowercase letters, digits, `-` and `_`, 2 to 32 characters, starting with a letter. Must equal the folder name. User packs may not use an official pack code, an id ending in `_encounter`, or a leading digit. |
| `name`       | yes      | Display name.                                                                                                                                                                                                   |
| `kind`       | yes      | `core`, `hero`, `scenario`, `campaign` or `mixed`.                                                                                                                                                              |
| `origin`     | yes      | `user` for your own packs. `official-bundled` and `official-sync` are for official content and are read-only in the editor when synced.                                                                         |
| `apiVersion` | yes      | The engine-to-pack contract version. Use `1`. A pack that asks for a newer one than the engine has is refused.                                                                                                  |
| `version`    | yes      | Your own version string, such as `0.1.0`.                                                                                                                                                                       |
| `dependsOn`  | no       | Ids of packs this one needs (for example `["core"]`). They are loaded automatically; a missing one blocks this pack. Defaults to none.                                                                          |
| `source`     | no       | Where the data came from, for credit.                                                                                                                                                                           |
| `art`        | no       | Art naming exceptions. `art.swapMainSchemeSides` is `true` only when main scheme side A is the second image of the pair, as in the Core Set art.                                                                |

## Card codes

User cards are coded `<packId>-NNNN` (four digits), with an optional side letter `a` to `f` for the faces of one card: `first-pack-0001a` and `first-pack-0001b`. Codes must be unique across all enabled packs. Supplemental data is keyed by these codes, and may only name cards from its own pack or a pack it depends on.

## Art

The game fetches official art on demand from MarvelCDB into a local cache. For your own cards, put `<code>.png` under `assets/cards/` in your pack (or the file name your card data names). Do not commit official art or rules PDFs to a repository; `npm run leak:check` fails if you try.

## Checking a pack

`npm run pack:validate -- content/packs/<id>` checks the manifest, the card codes and fields, every JSON file against its schema, dependencies and duplicate codes. Fix everything it prints; the game refuses a pack with a finding.
