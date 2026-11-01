# Sharing and installing packs

## What works today

A pack is a folder, so sharing is copying a folder.

**To share your pack:** run `npm run pack:validate -- content/packs/<id>`, then zip the `content/packs/<id>/` folder (or publish it in a Git repository). Include a licence and say clearly that it is fan content. Do not include official card art or rules PDFs.

**To install someone else's pack:**

1. Read its `pack.json` first. A user pack is JSON only and cannot run code, but you still decide whether you trust the author.
2. Put the folder in `content/packs/` (the folder name must equal the pack `id`).
3. Add its id to `enabledPacks` in `content/config.json`, and any pack it lists in `dependsOn` must be present too.
4. Run `npm run pack:validate -- content/packs`, then reload the game. The Content screen shows the pack as **Playable**, **Data only**, **Needs pack** or **Failed**, with the reason.

## Not built yet

These are planned, not available: importing a zip from the browser, adding a content folder from the welcome screen (both buttons are shown disabled), and packs that carry their own code. Until then, use the steps above.
