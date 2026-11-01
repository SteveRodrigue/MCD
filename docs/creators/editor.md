# The supplemental editor

The editor is where you give cards their rules data (abilities, costs, triggers) without writing JSON by hand. It runs in the browser and saves into your pack's `supplemental/` folder. It works only on the dev server, because saving needs to write files: start the game with `npm run dev`.

## Open it

- Go to `/editor` on the dev server, or right-click a card on the tabletop (it opens in a new tab focused on that card, and your game keeps running).
- Or use "Open in Supplemental Editor" in a card's detail view.

## What you see

On the left, the card list with a **Pack** selector and filters (set, faction, hero, status, search). In the middle, the card as the game shows it. On the right, the supplemental builder: a **Form** view and a **Raw JSON** view with live validation.

Only packs enabled in `content/config.json` are listed. If your pack is missing, enable it and reload.

## Saving

**Save Card** writes `content/packs/<id>/supplemental/<file>.json` for the pack that owns the card, after checking the data against the schema. Reload the game tab to play with the change.

- You can save into packs whose `origin` is `user` or `official-bundled`. Editing the Core pack changes tracked files, which `git status` will show.
- Packs with origin `official-sync` are read-only: they are downloaded again, so edits would be lost.
- Data that fails validation is refused with the reason, and nothing is written.

## Next

Which fields to fill in is described in [cards-and-heroes.md](cards-and-heroes.md), and every ability, trigger and effect in the [supplemental reference](supplemental-reference/README.md). How the editor works inside is in [editor-architecture.md](../engine/editor-architecture.md).
