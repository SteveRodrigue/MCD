# Art packs

An art pack replaces the picture on any card with images on your own computer. It changes nothing else: rules, stats and saved games stay the same, and the game plays normally without one.

Art packs are never committed. `content/art-packs/` is ignored by git, because fan art rarely has a license that lets this repository share it. Design decisions: [ADR-0093](../decisions/0093-optional-art-packs.md).

## Install an art pack

1. Create `content/art-packs/<id>/`, where `<id>` matches the `id` in the pack's `art-pack.json`.
2. Put `art-pack.json` and the PNG files directly in that folder.
3. Start or reload the game. The Content screen lists the pack under **Art packs**, along with any problems.

To remove a pack, delete its folder. No setting needs to change.

**Working with git worktrees:** ignored files are not shared between worktrees, so each new worktree starts without art packs. Copy the folder in if you want them there.

## Format

```json
{
  "$schema": "../../../src/data/packs/art-pack.schema.json",
  "id": "my_art",
  "name": "My alternate art",
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
| `name`                     | yes       | Display name on the Content screen.                                                                             |
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

## When something is wrong

| Problem                                       | What happens                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| Invalid `art-pack.json`                       | The pack is skipped. The Content screen shows why.                            |
| A PNG is missing or fails to load             | The card shows its official art, or the labelled card back for a token.       |
| A listed card is not loaded                   | The entry is ignored, with a warning on the Content screen.                   |
| Two packs list the same card                  | The first by folder name wins, with a warning on the Content screen.          |
| Stat images on a card with no stats to follow | The card always shows its lowest image, with a warning on the Content screen. |

## Limits

- Images must be PNG files.
- The browser keeps images for a long time, so a replaced image needs a new file name.
- Card backs cannot be replaced.
- A facedown card always shows its back, so an art pack never reveals a hidden card.
