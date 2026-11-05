# Art packs

An art pack replaces the picture on any card with images on your own computer. It changes nothing else: rules, stats and saved games stay the same, and the game plays normally without one.

Art packs are never committed. `content/art-packs/` is ignored by git, because fan art rarely has a license that lets this repository share it. Design decisions: [ADR-0093](../decisions/0093-optional-art-packs.md).

## Install an art pack

1. Create `content/art-packs/<id>/`, where `<id>` matches the `id` in the pack's `art-pack.json`.
2. Put `art-pack.json` and the PNG files directly in that folder.
3. Start or reload the game. The pack appears under **Art packs** in the Options menu and on the Content screen, along with any problems.

To remove a pack, delete its folder. No setting needs to change.

## Turning packs on and off, and browsing them

A pack is on as soon as it is found. In the Options menu (**Art Packs**) and on the Content screen, each pack shows its name, description, credit and image count, with a switch and a **Browse** button.

- **Switch:** off shows the official art again for every card the pack covers, at once and without restarting a game. A scenario token with no official art (the Ultron Drone) shows its labelled card back. If two packs list the same card, the first pack that is on, by folder name, wins. The choice is saved in your browser, so it is per browser and not shared between devices or git worktrees.
- **Browse:** opens every image of the pack, whether it is on or off, labelled with the card name and code, and the printed ATK and hit points of a stat image. A filter narrows the list by card name or code, and a click enlarges an image. Images are shown whole and unaltered.

**Working with git worktrees:** ignored files are not shared between worktrees, so each new worktree starts without art packs. Copy the folder in if you want them there.

## Format

```json
{
  "$schema": "../../../src/data/packs/art-pack.schema.json",
  "id": "my_art",
  "name": "My alternate art",
  "description": "Alternate art for the Spider-Man identity cards.",
  "credit": {
    "author": "Who made the images",
    "sourceUrl": "https://example.com/where-they-came-from",
    "unofficial": true
  },
  "cards": {
    "01001a": [{ "file": "spider_man.png" }],
    "01001b": [{ "file": "peter_parker.png" }]
  }
}
```

| Property                   | Required  | Meaning                                                                                                         |
| -------------------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| `id`                       | yes       | Lowercase letters, digits, `-` and `_`, 2 to 32 characters, starting with a letter. Must equal the folder name. |
| `name`                     | yes       | Display name in the art pack list.                                                                              |
| `description`              | yes       | 1 to 300 characters: what the pack contains and when to use it. Shown in the art pack list and the Browse view. |
| `credit.author`            | yes       | Who made the images. Shown in the card's right-click menu and on the Content screen.                            |
| `credit.sourceUrl`         | yes       | Where the images came from.                                                                                     |
| `credit.unofficial`        | yes       | `true` shows "(unofficial)" beside the author.                                                                  |
| `cards`                    | yes       | Card code to its images.                                                                                        |
| `cards.<code>[].file`      | yes       | A PNG in this folder: letters, digits, `_` and `-`, ending in `.png`.                                           |
| `cards.<code>[].attack`    | see below | The ATK this image prints.                                                                                      |
| `cards.<code>[].hitPoints` | see below | The hit points this image prints.                                                                               |

## Which cards

Any loaded card, by its code:

- **Two-sided cards** use one code per side: `01001a` (hero) and `01001b` (alter-ego), `01137a` and `01137b` (main scheme).
- **Villain stages, schemes, minions, allies, player cards** and cards from user packs use their own codes.
- **Scenario tokens** with no printed card use the code the scenario declares (see [scenarios.md](scenarios.md)), such as `ultron_drone`.

A landscape card stays landscape, so use an image with the same shape. The game shows a pack's image everywhere it draws the card, except the Card Editor, which always shows official art.

## Images that follow stats

A minion, ally or villain can list several images, each printing its stats. The card shows the highest image whose `attack` and `hitPoints` are both at or below its current values. If none qualifies, it shows the lowest. The badges beside the card always show the exact values.

A card with one image can leave out both stats. With several images, every image needs both.

Worked example, the Ultron Drone tokens by AlfoP09 aka chaodck (`content/art-packs/ultron_tokens/art-pack.json`):

```json
{
  "id": "ultron_tokens",
  "name": "Ultron Drone tokens",
  "description": "Four Drone tokens, Mk. I to Mk. IV, that change as the Drones grow.",
  "credit": {
    "author": "AlfoP09 aka chaodck",
    "sourceUrl": "https://www.reddit.com/r/marvelchampionslcg/comments/upvi1k/ultron_drone_token_cards/",
    "unofficial": true
  },
  "cards": {
    "ultron_drone": [
      { "file": "ultron_drone_mk1.png", "attack": 1, "hitPoints": 1 },
      { "file": "ultron_drone_mk2.png", "attack": 2, "hitPoints": 2 },
      { "file": "ultron_drone_mk3.png", "attack": 3, "hitPoints": 3 },
      { "file": "ultron_drone_mk4.png", "attack": 4, "hitPoints": 4 }
    ]
  }
}
```

| Drone state                                          | ATK / hit points | Shows   |
| ---------------------------------------------------- | ---------------- | ------- |
| Base (Ultron Drones)                                 | 1 / 1            | Mk. I   |
| Ultron III, or 1 Upgraded Drones                     | 2 / 2            | Mk. II  |
| Ultron III + 1 Upgraded Drones, or 2 Upgraded Drones | 3 / 3            | Mk. III |
| Ultron III + 2 Upgraded Drones                       | 4 / 4            | Mk. IV  |
| A temporary effect gives ATK 3 with 2 hit points     | 3 / 2            | Mk. II  |

Without this pack, a Drone is a player card back with a "Drone" label and its badges.

## What the game checks when it loads a pack

A bad art pack never stops a game. The loader checks, and the Content screen lists:

- `art-pack.json` matches the format above, including `description`, and its `id` equals the folder name. Otherwise the pack is skipped.
- Each listed PNG exists in the pack folder. A missing file is a warning, and that image is not used or shown in Browse.
- Each listed card code is a loaded card or a scenario token, and stat images are only on cards that have stats.

It does not open the images, so their size and shape are up to you (see below).

## When something is wrong

| Problem                                       | What happens                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| Invalid `art-pack.json`                       | The pack is skipped. The Content screen shows why.                            |
| A listed PNG is missing from the folder       | A warning on the Content screen; that image is not used.                      |
| A PNG fails to load                           | The card shows its official art, or the labelled card back for a token.       |
| A listed card is not loaded                   | The entry is ignored, with a warning on the Content screen.                   |
| Two packs list the same card                  | The first by folder name wins, with a warning on the Content screen.          |
| Stat images on a card with no stats to follow | The card always shows its lowest image, with a warning on the Content screen. |

## Hero and alter-ego art

Identity cards work like any other card: one code per side, one image per code.

- A hero and its alter-ego are `NNNNNa` and `NNNNNb`. The first Spider-Man is `01001a` and `01001b`.
- A hero can have several identity versions, each with its own pair: Ironheart has `29001a/b`, `29002a/b` and `29003a/b`.
- Some heroes have a third face with its own code: Ant-Man `12001c`, Wasp `13001c` and Angel `42001c` (Archangel).
- Not every `b` code is an identity side. SP//dr's identity is `31001a` (hero) and `31002a` (alter-ego).
- Use the printed card's shape (check with `npm run card:get -- <code>`), with the bleed already cut off, and leave the artist's watermark and signature as they are. Name each file after its card code, such as `29002a.png`.
- A hero the pack does not list keeps its official art.

The game ships no converter. Make the PNGs by hand or with your own tools.

## Clearing the image cache

The browser keeps pack images for a long time. After replacing an image under the same file name, open the browser's developer tools, go to Application, then Storage, then Cache storage, delete the entry `mcd-card-art-v2`, and reload. Giving the new image a new file name avoids the step.

## Limits

- Images must be PNG files.
- The browser keeps images for a long time, so a replaced image needs a new file name.
- Card backs cannot be replaced.
- A facedown card always shows its back, so an art pack never reveals a hidden card.
