# [ADR-0093] Optional Local Art Packs

* **Status:** Accepted
* **Date:** 2026-11-03
* **Authors:** MCD Core Team
* **Deciders:** Project Maintainer
* **Extends:** [ADR-0092](0092-content-packs-and-runtime-loading.md) decision 8 (images)
* **Related:** [Issue #613](https://github.com/SteveRodrigue/MCD/issues/613), [Issue #552](https://github.com/SteveRodrigue/MCD/issues/552), [ADR-0089](0089-structural-sharing-for-state-updates.md), [creator guide](../creators/art-packs.md)

---

## Context and Problem Statement

A card can only show its official art, and a card with no printed version has nothing to show. An Ultron Drone is a card back with a label. Players also want alternate art on other cards.

Fan art rarely has a license that fits this public, MIT-licensed repository, and it often reuses imagery the creator does not own. It cannot be committed, and the game must work the same for someone who does not have it.

---

## Decision Drivers

* The default game needs no extra files. A fresh clone plays Ultron with card backs.
* The repository never holds or redistributes third-party images.
* Art is cosmetic: it must not change rules, seeds or saved games, and `src/engine` stays unaware of it.
* It works with any card, reusing the art route and cache rather than adding a parallel path.

---

## Considered Options

1. **Commit fan art in a content pack.** Rejected: unknown license in a public repository.
2. **Download on demand into `content/.cache`.** Rejected: needs stable image links and a downloader change, and still distributes the art without clear permission.
3. **A gitignored folder of local art packs, used when found (chosen).**

---

## Decision Outcome

**Chosen Option:** **Option 3: Local art packs.**

### Decisions

1. **Location.** `content/art-packs/<id>/` holds `art-pack.json` and PNG files. The folder is gitignored and is separate from `content/packs/`, because an art pack holds no game data.
2. **Found means available, used unless switched off.** The app lists the folder through the content driver, with no `config.json` entry. A pack found is on by default, and the player can switch each pack off in the Options menu or on the Content screen (amended 2026-11-05, Issue #618). The choice is a display setting stored in the browser (`disabledArtPacks`), never in `GameState`; the first pack that is on and lists a card is the one used. Removing the folder also restores the default.
3. **Only the app reads them.** `loadContent` reads art packs only with `{ artPacks: true }`, which `main.tsx` passes. Tests and scripts get the same results with or without a developer's local art pack.
4. **Serving.** Images use the existing route as `/card-art/_art-<id>/<file>.png`. The id and file name are validated, and nothing is ever downloaded for an art pack.
5. **Any card.** A pack lists card codes. Two-sided cards are targeted through their own codes (`01001a`, `01137b`). A scenario token with no printed card is declared in `definition.json` (`tokens`), which also makes its stats data.
6. **Stat images.** A card can list several images with printed `attack` and `hitPoints`. It shows the highest image whose printed values are both at or below its current values, otherwise the lowest. This applies to minions, allies and villains. The stat badges stay the source of truth.
7. **Hidden information.** A facedown card always shows its back. Only a shell, whose only face is its own card, shows art while facedown.
8. **Failure.** A failed image falls back to the official art, or to the labelled back for a token. An invalid `art-pack.json` is a load failure, and other problems are warnings. The Content screen lists them, and the game still starts.
9. **Credit and description.** `art-pack.json` requires a credit and a description (1 to 300 characters). The card's right-click menu, the art pack list and the Browse view show them.
10. **Card Editor.** The editor always shows official art, because card data is reviewed against the printed card.
11. **Loading with the scenario.** When a game starts, the UI preloads the images of the scenario's tokens, so the next stat image shows at once.

12. **Load-time validation.** Beyond the manifest, the loader checks that every listed PNG exists in the pack folder (the dev server's content index names the PNG files of art packs, but never serves them through `/__content`). A missing file is a warning and the image is dropped, so its card keeps its official art. Image dimensions and shape are not checked at load: the driver reads no binary files, and a failed image already falls back (decision 8).
13. **Browse.** A modal shows every image of a pack, on or off, with the card name, code and printed stats, a filter and an enlarged view. Images are shown whole and unaltered.
14. **Conversion tooling is outside MCD.** Turning a fan release (print sheets, bleed, PDF pages) into an art pack is the pack author's job. The repository ships no converter, recipe or image library, and no fan art. The first large pack, Corbintm's alternate-art heroes, is built with a separate private tool.

### Rationale ("The Why")

A local folder separates the game from the images: the game defines a format, and each player decides what to install. Reusing the art route and cache keeps one image path, and passing the lookup through `localArtUrl` gives every card view the feature without call-site changes.

---

## Consequences

* **Positive:** Any card can have alternate art. The repository holds no third-party images. Ultron plays the same with or without its tokens.
* **Negative:** Art packs are per machine, and git worktrees do not share ignored files, so each new worktree starts without them. The art route is PNG only, and it caches files as immutable, so a replaced image needs a new file name.
* **Limits:** Card backs cannot be replaced. A prompt thumbnail only knows a card code, so it reads the stats of the first in-play copy of that card.

---

## References

* [ADR-0092: Content Packs & Runtime Loading](0092-content-packs-and-runtime-loading.md)
* [ADR-0011: Card Orientation & Cache-First Art Resolution](0011-card-orientation-and-art-caching.md)
* [Creator guide: art packs](../creators/art-packs.md)
