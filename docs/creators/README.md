# Creating content for Marvel Champions Digital

Everything the game plays comes from **packs**. A pack is a folder in `content/packs/` with a `pack.json` and the cards, rules data and scenarios it adds. The Core Set is a pack, and so is yours. This page gets you from nothing to a pack the game loads.

| I want to…                                                              | Read                                                        |
| ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| Make my first pack in ten minutes                                       | this page                                                   |
| Know every `pack.json` property, the folder layout and the naming rules | [pack-format.md](pack-format.md)                            |
| Design a hero and its 22 cards                                          | [cards-and-heroes.md](cards-and-heroes.md)                  |
| Make a villain and a scenario                                           | [scenarios.md](scenarios.md)                                |
| Look up an ability, trigger, cost or effect                             | [supplemental-reference/](supplemental-reference/README.md) |
| Edit rules data in the browser                                          | [editor.md](editor.md)                                      |
| Share a pack, or install someone else's                                 | [sharing-and-installing.md](sharing-and-installing.md)      |

## Your first pack

The folder [`examples/first-pack/`](examples/first-pack/pack.json) is a complete, tested pack with one hero (`Pocket Hero` and the alter-ego `Pocket Alter-Ego`). A test loads it with the real game loader on every build, so these steps work.

1. **Copy the folder** to `content/packs/first-pack/` (the folder name must equal the pack `id`). Do not copy `supplemental.sample.json` yet.
2. **Enable it** by adding its id to `content/config.json`:

   ```json
   { "enabledPacks": ["core", "first-pack"] }
   ```

3. **Check it** with `npm run pack:validate -- content/packs/first-pack`. No output other than `pack:validate passed.` means the manifest, card codes and card fields are sound.
4. **Start the game** (`npm run dev`) and open the Content screen. The pack is listed as **Data only**: the engine knows the cards but no rules, so they cannot be played yet.
5. **Add rules data.** Create `content/packs/first-pack/supplemental/` and copy `supplemental.sample.json` into it as `first_pack.json`. The sample marks the hero as needing no ability code. Reload: the pack is now **Playable**. Use `npm run pack:status` to see the same states in a terminal.
6. **Make it yours.** Change the names and stats in `cards/my_hero.json`, then give the hero real abilities with the [editor](editor.md) or by hand, following [cards-and-heroes.md](cards-and-heroes.md).

## Ground rules

- A user pack is **JSON only**. Code (`scripts/`) is accepted only in official packs, and `pack:validate` rejects it in a user pack.
- Card codes are `<packId>-NNNN`, with a side letter (`a`, `b`) for two-sided cards. `pack_code` on every card is the pack id, at most 10 characters.
- Card files keep the upstream [zzorba / MarvelCDB](https://github.com/zzorba/marvelsdb-json-data) format. Rules data lives apart from it, in `supplemental/`.
- Card art is not shipped with the game. Put your own images under `content/packs/<id>/assets/cards/`; see [pack-format.md](pack-format.md).
- Run `npm run pack:validate -- content/packs` before you share a pack.

This is a fan project; see the disclaimer on the game's welcome screen.
