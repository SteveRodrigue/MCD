# Plan: Art pack switch, description, Browse view and hero art check (Issue #618)

> **Status:** Draft v4 for owner review. Nothing is implemented. Milestone: Gate 2 (as the issue).
> **Goal of the issue:** prove that the art pack engine (ADR-0093) works well with Hero and Alter-Ego cards, using a fan-made set (Corbintm's alternate identity cards, on r/marvelchampionslcg and Google Drive) that has an alternate card for every hero.
> **Scope of this plan:** the MCD side only. Converting the fan files into a pack is done in the separate **MCD Art Pack Tools** project (private, Python), which hands over a finished pack folder. MCD's repository holds no converter, recipe, image library or fan art.
> **Owner decisions (2026-11-05):**
> 1. The converter is outside MCD, in its own project. When the pack is ready it is placed in `content/art-packs/` (kept private through the private data repo).
> 2. MCD keeps the loading and validation of art packs, plus an on/off switch for each pack in the configuration menu, a short description per pack, and a click-to-browse view of all its artwork. Built now, not parked.
> 3. MCD does a minimum of validation when it loads a pack.
> 4. The browser-cache problem after a rebuild is documented, not engineered.
> 5. A note to Corbintm is sent later by the owner.

## 1. In-Game Scenario

**Setup.** The player has installed the pack `content/art-packs/corbintm_alt_heroes/` and starts a game with Ironheart (identity set 3), Ant-Man and Angel, one after the other.

**What the player does.** Opens the configuration menu and finds an **Art packs** list. Each pack shows its name, a short description, its credit, an on/off switch and a **Browse** button. The player browses Corbintm's pack (all its images, each labelled with its card), switches it on, then opens Hero Select, picks the hero, starts a mission, plays a turn, flips to alter-ego and back, and (for the triple-sided heroes) changes to the third form if the engine offers it. Later the player switches the pack off and the same cards show official art again, without restarting.

**Today.** Every identity card shows MarvelCDB art. Only the Ultron Drone tokens come from an art pack, and a pack found on disk is always used: there is no switch, no description and no way to see what a pack contains.

**After the change.** With the pack on, each identity side shows Corbintm's card: hero side, alter-ego side, and the third face of Ant-Man, Wasp and Angel. Ironheart's three identity versions each show their own image. A hero the set does not cover keeps its official art. With the pack off, or the folder deleted, nothing differs from official art (and the Drone shows its labelled card back).

**Why by the rules.** Art is cosmetic (ADR-0093, driver 3). No rule, stat, seed or saved game changes. The switch is a display setting stored in the browser, never in `GameState`.

## 2. What exists, and what is missing

Read in the repository on `main` (checked 2026-11-05):

| Piece                      | Where                                                                           | Status for this job                                                                                                                                                                                  |
| :------------------------- | :------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format and loader          | `src/data/packs/art-pack.ts`, `src/data/content/loader.ts`                      | Done, except there is no `description`. The loader validates the manifest (Zod), that `id` equals the folder name, that listed cards are loaded, and duplicate claims. It does **not** check that the listed PNG files exist. |
| Lookup and route           | `src/data/content/card-art.ts`, `src/tools/card-art-middleware.ts`              | Done. `localArtUrl` is the single path; any code can have an image. It picks the first pack (by folder name) that lists a card, with no notion of "disabled".                                         |
| Never committed            | `.gitignore` (`content/art-packs/`), `tools/audit/leak-guard.ts` (`image` rule) | Done. Any tracked PNG or JPG fails `leak:check`.                                                                                                                                                     |
| Private backup and sharing | `scripts/private-assets.ts` (`assets:pull`, `assets:push`)                      | Done. Moves `content/art-packs/` to and from the private data repo and junctions it into every worktree.                                                                                             |
| Display settings           | `src/ui/context/GameSettingsProvider.tsx`, `OptionsMenu.tsx`                    | Done and reusable: settings persist in `localStorage` (read and written inside `try/catch`), and `OptionsMenu` is a list of `SettingPanel` rows. No art pack setting yet.                              |
| Content screen             | `src/ui/components/setup/ContentScreen.tsx`                                     | Lists art packs with credit and problems. No switch, no description, no gallery.                                                                                                                     |
| Tested on                  | Ultron Drone tokens (ADR-0093)                                                  | Tokens only. No identity card has ever used it.                                                                                                                                                      |
| **Identity cards in-game** | `HeroZone`, hero select, deck builder, `CardView`                               | **Unverified.** They should go through `localArtUrl`; M3 proves it.                                                                                                                                  |

MCD work: a required `description`, minimum load validation, an on/off setting that the art lookup honors, a Browse view, a test of the identity path, an in-game verification, and documentation. The pack format otherwise needs no change.

## 3. Copyright and distribution rules (binding for every step)

1. **No images in git, ever, in MCD.** Not the originals, not the converted PNGs, not thumbnails. `leak:check` stays green with no allowlist entry.
2. **No screenshots** in the repository, the PR, issues, comments or docs. Visual checks are done by the owner on the PC; any report back is written in words.
3. **Test images are synthetic.** MCD tests generate coloured rectangles in a temp folder at run time, or use URLs only. No fan art or official art is used as a fixture.
4. **Sources stay out of the pack folder.** The loader lists every folder under `content/art-packs/` and reports one without an `art-pack.json` as a failure.
5. **MCD never downloads the set and never ships a converter for it.** Each player gets the files from Corbintm's Drive. The finished pack is private to the owner (private data repo).
6. **The watermark stays.** The small headshot top-left is the creator's unifying mark. MCD shows images whole and unaltered, in game and in Browse.
7. **Credit is required and visible.** `credit.author`, `credit.sourceUrl` (the Reddit post) and `credit.unofficial` are shown in the card menu, the pack list and the Browse view.
8. **Permission.** The set is shared "to print and enjoy", with no license text. Local use by someone who downloaded it from the author is consistent with that. Redistribution is not, so the private repos stay private. The owner will send Corbintm a note later saying MCD can display the set from local files and never ships it. This does not block the work.

## 4. Design

### 4.1 Where each piece lives

| Piece                                                                       | Where                                   |
| :-------------------------------------------------------------------------- | :-------------------------------------- |
| Format, loader, minimum validation, lookup, route, leak guard               | MCD                                     |
| `description` field, on/off switch, Browse view, identity tests, creator docs, ADR amendment | MCD                                     |
| Converter (PDF extraction, sheets, bleed, fold panels to per-card PNGs), recipe, coverage | MCD Art Pack Tools project (not MCD)    |
| Finished pack `content/art-packs/corbintm_alt_heroes/`                      | Private data repo, via `assets:push`    |

What MCD tells the Tools project (they have their own brief): the manifest format (section 5.1), file naming `<code>.png`, the identity code rules (4.2), and that bleed is already removed and the watermark untouched.

### 4.2 Mapping images to card codes (the facts the pack must follow)

The ground truth is the loaded identity cards (`type_code` `hero` or `alter_ego`), not an assumed `a`/`b` pairing. Today that is 145 codes over about 70 heroes. Cases that break a naive rule:

- Ironheart has three identity versions: `29001a/b`, `29002a/b`, `29003a/b`.
- Ant-Man, Wasp and Angel have a third face with its own code: `12001c`, `13001c`, `42001c` (Archangel).
- SP//dr's identity is `31001a` (hero) and `31002a` (alter-ego); their `b` codes are a support and an upgrade, not identity sides.

A pack maps each code to a file named after the code (`29002a.png`), which satisfies `CARD_ART_FILE_PATTERN`. Heroes the set does not cover keep official art and are never an error.

### 4.3 Special cases in MCD

| Case                            | Handling                                                                                                                                                                                                                                                                 |
| :------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero and alter-ego              | Two codes (`NNNNNa` and `NNNNNb`). The existing lookup already treats them as separate cards.                                                                                                                                                                            |
| Several identity cards per hero | Each version has its own code pair; no engine change. M3 checks that each version is selectable and shows its own image.                                                                                                                                                  |
| Triple-sided heroes             | The third face is a normal card code. M3 checks which of the three the game can show; if the engine never displays a `c` face today, the art is still mapped (ready for later), it appears in Browse, and a GitHub issue is opened for the missing form change.             |
| Orientation                     | The pack image must have the shape the app expects for the card (ADR-0011). M3 confirms whether identity cards are portrait in the app, from the loaded data, and passes the fact to the Tools project.                                                                  |
| Two packs list the same card    | Unchanged rule, now applied to enabled packs only: the first enabled pack by folder name wins. Switching one off lets the next one show. The load warning "is also listed by ..., which is the one used" is reworded to "by folder order" because the winner now depends on the switch. |
| Card Editor                     | Still shows official art by design (ADR-0093, decision 10). The Browse view is not the editor and shows pack art.                                                                                                                                                        |
| Worktrees and agents            | The finished pack lives in the private data folder; `assets:pull` junctions it into every worktree. The on/off choice is per browser, not per worktree.                                                                                                                  |

## 5. MCD feature: validation, description, switch and Browse

### 5.1 Manifest: `description`

`art-pack.json` gains `description`, a required string of 1 to 300 characters: what the pack contains and when to use it. The Zod schema in `art-pack.ts` is the source; `schema:generate` regenerates `art-pack.schema.json`. Required because the owner wants every pack to explain itself, and art packs are two days old with a single known pack (Ultron tokens, whose JSON gets one added line in the private data repo). No shim: a pack without it fails to load with a clear message on the Content screen.

### 5.2 Minimum validation on loading

Art is cosmetic, so a bad pack never stops a game (ADR-0093 decision 8). What the loader checks, in the existing `readArtPacks`:

| Check                                                       | Result                                              | Status          |
| :---------------------------------------------------------- | :-------------------------------------------------- | :-------------- |
| `art-pack.json` parses and matches the schema (incl. `description`, credit, file name pattern) | Pack skipped, failure shown                         | Exists + new field |
| `id` equals the folder name                                 | Pack skipped, failure shown                         | Exists          |
| Every listed card code is a loaded card or scenario token   | Warning, entry ignored                              | Exists          |
| Stat images only on cards that have stats                   | Warning                                             | Exists          |
| Two packs list the same card                                | Warning naming the pack that wins                   | Exists, reworded (4.3) |
| **Every listed `file` exists in the pack folder**           | Warning per missing file; that image is not offered | **New**         |
| **A file listed twice for different cards**                 | Nothing (allowed)                                   | Decided         |

The new check uses `driver.listFiles('art-packs/<id>')`, which the content driver already offers, so no new driver method is needed. Deliberately not checked at load time: image dimensions, aspect ratio and PNG validity, because the driver cannot read binary files and a failed image already falls back to official art at display time. Those checks belong to the Tools project, which sees the real files before the pack is installed.

### 5.3 The switch

- **State:** `disabledArtPacks: string[]` (pack ids) in the existing `GameSettings`, persisted by `GameSettingsProvider` in `localStorage`. Disabled, not enabled, so a newly installed pack is on by default, which keeps Ultron behaving as today. An unknown id in the list is ignored.
- **Honored in one place:** `card-art.ts` builds its index from the loaded art packs. It gets the disabled ids from a small non-React holder (the lookup is a plain function used outside React); the settings provider writes to it whenever the setting changes, and the index rebuilds when the content or the disabled set changes. `artPackArt`, `artPackHasStatImages`, `artPackImageUrls` and `localArtUrl` all go through the same index, so no call site changes. A disabled pack's images are not preloaded.
- **Live update:** the holder exposes a subscription (`useSyncExternalStore`), so `useCardArt` and `CardView` re-render when the switch flips, without a restart and without touching `GameState`.
- **Tokens:** switching off a pack that provides scenario tokens (Ultron Drone) falls back to the labelled card back, which the fallback path already handles.

### 5.4 Where it appears

One component, `ArtPackSettings`, rendered in two places: the in-game **Options menu** (the configuration menu, as a new `SettingPanel` section "Art packs") and the **Content screen** (reachable without starting a game). Each row shows name, description, credit (author, "(unofficial)", link to the source), image count, a switch and a **Browse** button. The existing problem list (invalid packs, warnings) stays on the Content screen and is linked from the row of a pack that has warnings. When no art pack is installed, the section says so and points to the creator guide; it never shows an error.

### 5.5 Browse view

A modal opened by **Browse** shows every image of the pack, whether or not the pack is on:

- Grouped by card, each tile labelled with the card code, the card's name and side (from the loaded card data), and, for stat images, the printed ATK and hit points. A code that no loaded card owns is shown with its code only and a warning mark.
- Images load lazily from the existing `/card-art/_art-<id>/<file>.png` route, through the same cache as in-game art, so a pack of about 145 images does not load at once.
- Clicking a tile enlarges the image (the existing card zoom where it fits, otherwise a simple enlarged view in the same modal). The image is shown whole and unaltered (rule 6).
- Credit and description sit at the top. A text filter by card name or code is included because the Corbintm pack has about 145 images; nothing else (sorting, favourites) is added.
- A broken or missing image shows a placeholder tile with its file name, not an error.

### 5.6 Engine, schema and other changes

- `src/engine`: **none.**
- Art pack schema: `description` added. Creator docs and the generated schema are updated in the same change.
- Everything else is UI and data-layer code in `src/data/content/loader.ts`, `src/data/content/card-art.ts`, `src/ui/context/*`, `ContentScreen.tsx`, `OptionsMenu.tsx` and a new `ArtPackSettings` plus browse modal.

Identity-card risks that M3 checks (any gap is fixed in its path, not deferred):

- Hero select, `HeroZone`, board zoom, the deck builder list and any identity thumbnail all call `localArtUrl`/`useCardArt` with the identity's own code.
- Flip between hero and alter-ego swaps the image without a blank frame (pack images are not preloaded like scenario tokens; if it flashes, preload the identity codes at game start).
- On-card UI (badges, name plates, damage counters) does not cover the watermark in a way that matters.
- A missing or broken image falls back to official art (existing behaviour, retested for an identity card).

## 6. Tests in MCD (written first)

All use synthetic data: empty or generated files in a temp folder, or URLs only.

- **Manifest:** `description` required, 1 to 300 characters; the generated JSON schema matches the Zod schema (existing guard).
- **Loader:** a listed `file` that is missing gives a warning naming pack, card and file; a pack with all files present gives none; the reworded duplicate warning.
- **Lookup:** with two synthetic packs listing the same card, the first enabled wins; disabling it lets the second win; disabling both returns `undefined`; an unknown id in the disabled list is ignored; stat-image selection and preloading skip a disabled pack.
- **Identity cards:** with a synthetic pack covering `29001a`, `29002b`, `12001c` and `31001a`, `artPackArt(code)` returns the pack URL for each, and an uncovered hero returns `undefined`.
- **Settings:** `disabledArtPacks` persists and reloads from `localStorage`; a failing `localStorage` leaves the default (all on) and does not throw.
- **UI:** `ArtPackSettings` lists packs with description and credit, the switch flips the setting, a `CardView` for a covered card changes its image URL when the switch flips (and falls back to official art when the pack is off or the image errors), **Browse** opens the modal with one tile per image and the card's name, the filter narrows the tiles, and the empty state shows when no pack is installed.
- Existing guards keep running: `leak:check`, `pack:validate`, `docs:check`, `schema:generate`. No allowlist entry is added.

## 7. Milestones

| #  | Step                                                                                                                                                        | Where                 | Done when                                                                      |
| :- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------- | :----------------------------------------------------------------------------- |
| M1 | `description` field, minimum load validation (missing files), switch state and lookup change, identity tests. Failing tests first.                          | MCD (cloud)           | Section 6 data tests green; `verify` green; no tracked image.                  |
| M2 | `ArtPackSettings` in Options menu and Content screen, Browse modal, tests, creator docs for the new field, validation and switch. Ultron pack gets its description. | MCD (cloud, PC check) | UI tests green; owner sees the list, switch and Browse with the Ultron pack.   |
| M3 | Once the Tools project delivers the pack into `content/art-packs/`: in-game check (list below). Fix what it finds in its path.                              | Steve's PC (RC)       | All items pass; findings fixed or issued.                                      |
| M4 | Docs finished, ADR amendment, changelog fragment, delete this plan file in the delivering commit, close #618.                                              | Cloud                 | PR merged ("Merge" from Steve); #618 closed with `Fixes #618`.                 |

M1 and M2 can ship as their own pull requests before the pack exists, since they are useful with the Ultron pack alone. #618 closes with the last one. The Tools project runs in parallel and does not block M1 and M2.

**M3 checklist** (a person looks; nothing is captured):

1. Options menu and Content screen list the packs with description and credit; switch off and on changes art live in a running game; the choice survives a reload.
2. Browse shows every image of the Corbintm pack with the right card names, filter works, enlarged view is whole and unaltered.
3. Spider-Man (plain pair): hero select, board, zoom, flip to alter-ego and back.
4. Ironheart: all three versions are selectable and each shows its own art in both forms.
5. Ant-Man, Wasp, Angel: both identity sides, and the third face wherever the game can show it.
6. A hero the set does not cover, a game with the pack off, and a game with the folder removed: official art, no errors. With the Ultron pack off, the Drone shows its labelled card back.
7. Content screen shows zero warnings for the pack; Card Editor still official; a deliberately renamed PNG gives a missing-file warning and falls back cleanly.

## 8. Documentation (MCD)

- `docs/creators/art-packs.md`:
  - New field `description` in the format table and the example.
  - What the loader checks (5.2), and what it leaves to the pack maker.
  - New section **Turning packs on and off and browsing them**.
  - New section **Hero and alter-ego art**: how identity codes work (pairs, several versions, third faces, SP//dr), the shape and size an image should have, bleed already removed, the watermark and credit expectation, and a statement that MCD ships no converter: make the PNGs by hand or with your own tooling. Corbintm's set appears only as the worked example, with no images.
  - **Clearing the image cache** (needed after replacing an image, because the browser keeps images for a long time): in the browser's developer tools, open Application, then Storage, then Cache storage, delete the entry `mcd-card-art-v2`, and reload. The other way is a new file name.
- ADR-0093: amendment (not a new ADR). Decision 2 changes from "found means used, no picker or saved setting" to "found means available, used unless switched off, default on, stored per browser"; adds the `description` requirement, the load-time file check, the Browse view, that conversion tooling is deliberately outside MCD, and the permission position (rule 8).
- `docs/backlog/teamwork_status_and_next_target.md`: update the queue.
- `changes/unreleased/618-art-pack-switch-and-hero-art.md` (type `Added`).
- This plan file is deleted in the commit that delivers the work.

## 9. Parked (not needed to prove the engine)

- Image content validation at load (PNG signature, dimensions, aspect ratio) and an MCD command that checks a pack against the loaded cards. The Tools project validates before install; add a checker in MCD only if pack authors ask.
- A "Clear art cache" button in the app (documented manual step instead).
- Choosing between several packs for the same card (the first enabled wins), and per-hero or per-card on/off inside a pack.
- Browser or desktop import of a zip (M11/Tauri are parked).
- Art for non-identity cards, localisation of art, replacing card backs.

## 10. Debt removed

None found. Looked at: `art-pack.ts`, `art-pack.schema.json`, `card-art.ts`, `loader.ts`, `image-cache.ts`, `card-art-middleware.ts`, `private-assets.ts`, `ContentScreen.tsx`, `GameSettingsProvider.tsx`, the creator guide and ADR-0093. ADR-0093 decision 2 is superseded by the switch and is rewritten, not left contradicting the code. The load warning that names "the one used" is reworded because the switch changes who wins. The only other candidate is the `preloadArtPackImages` call that today covers scenario tokens only; it is changed in M3 if the flip flashes, not before.

## 11. Open decisions for the owner

| # | Decision                                                                                                             | Recommendation                                                   |
| :- | :------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| 1 | Is `description` required (a pack without one fails to load) or optional?                                            | Required.                                                        |
| 2 | A newly found pack is on by default (the switch stores what is off).                                                 | On by default.                                                   |
| 3 | Show the list in both the in-game Options menu and the Content screen (one component), or only the Options menu.    | Both; the Content screen is reachable without starting a game.   |
| 4 | The on/off choice is stored in the browser (`localStorage`): per browser, not shared across worktrees or devices.    | Yes; it is the existing settings mechanism.                      |
| 5 | Two packs listing the same card: the first enabled by folder name wins, no per-card picker (parked).                 | Yes.                                                             |
| 6 | Load validation stops at "listed file exists"; image content checks stay with the Tools project (section 5.2).       | Yes.                                                             |
