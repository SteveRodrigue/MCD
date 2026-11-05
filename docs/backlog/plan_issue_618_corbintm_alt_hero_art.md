# Plan: Corbintm's alternate-art hero set as an art pack (Issue #618)

> **Status:** Draft v3 for owner review. Nothing is implemented. Milestone: Gate 2 (as the issue).
> **Goal of the issue:** prove that the art pack engine (ADR-0093) works well with Hero and Alter-Ego cards, using a fan-made set that has an alternate identity card for every hero.
> **Source:** Corbintm's set on r/marvelchampionslcg, shared through Google Drive (links in the issue). The cloud sandbox cannot reach Reddit or Drive, so the first step is an inventory on the owner's PC (M0).
> **Owner decisions so far (2026-11-05):**
> 1. The converter is outside MCD, in Python, in its own dedicated private repository. MCD gets no converter code, no image dependency and no recipe.
> 2. Art packs get an on/off switch in the configuration menu, each with a short description, and a click-to-browse view of all the pack's artwork. This is built now, not parked.
> 3. The converter must be able to extract images from PDFs.
> 4. The browser-cache problem after a rebuild is documented, not engineered.
> 5. A note to Corbintm is sent later by the owner.

## 1. In-Game Scenario

**Setup.** The player has installed the pack `content/art-packs/corbintm_alt_heroes/` and starts a game with Ironheart (identity set 3), Ant-Man and Angel, one after the other.

**What the player does.** Opens the configuration menu and finds an **Art packs** list. Each pack shows its name, a short description, its credit, an on/off switch and a **Browse** button. The player browses Corbintm's pack (all its images, each labelled with its card), switches it on, then opens Hero Select, picks the hero, starts a mission, plays a turn, flips to alter-ego and back, and (for the triple-sided heroes) changes to the third form if the engine offers it. Later the player switches the pack off and the same cards show official art again, without restarting.

**Today.** Every identity card shows MarvelCDB art. Only the Ultron Drone tokens come from an art pack, and a pack found on disk is always used: there is no switch, no description and no way to see what a pack contains.

**After the change.** With the pack on, each identity side shows Corbintm's card: hero side, alter-ego side, and the third face of Ant-Man, Wasp and Angel. Ironheart's three identity versions each show their own image. A hero the set does not cover keeps its official art. With the pack off, or the folder deleted, nothing differs from official art (and the Drone shows its labelled card back).

**Why by the rules.** Art is cosmetic (ADR-0093, driver 3). No rule, stat, seed or saved game changes, so no rules analysis is needed. The switch is a display setting stored in the browser, never in `GameState`.

## 2. What exists, and what is missing

Read in the repository on `main` (checked 2026-11-05):

| Piece                      | Where                                                                           | Status for this job                                                                                                                                                                                  |
| :------------------------- | :------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format and loader          | `src/data/packs/art-pack.ts`, `src/data/content/loader.ts`                      | Done, except there is no `description`. The loader validates the manifest and lists problems.                                                                                                        |
| Lookup and route           | `src/data/content/card-art.ts`, `src/tools/card-art-middleware.ts`              | Done. `localArtUrl` is the single path; any code can have an image. It picks the first pack (by folder name) that lists a card, with no notion of "disabled".                                         |
| Never committed            | `.gitignore` (`content/art-packs/`), `tools/audit/leak-guard.ts` (`image` rule) | Done. Any tracked PNG or JPG fails `leak:check`.                                                                                                                                                     |
| Private backup and sharing | `scripts/private-assets.ts` (`assets:pull`, `assets:push`)                      | Done. `~/.mcd/private-content` is a git clone of the private data repo; `assets:push` runs `git add .` there; `assets:pull` junctions `content/art-packs/` into every worktree.                       |
| Display settings           | `src/ui/context/GameSettingsProvider.tsx`, `OptionsMenu.tsx`                    | Done and reusable: settings persist in `localStorage` (read and written inside `try/catch`), and `OptionsMenu` is a list of `SettingPanel` rows. No art pack setting yet.                              |
| Content screen             | `src/ui/components/setup/ContentScreen.tsx`                                     | Lists art packs with credit and problems. No switch, no description, no gallery.                                                                                                                     |
| Tested on                  | Ultron Drone tokens (ADR-0093)                                                  | Tokens only. No identity card has ever used it.                                                                                                                                                      |
| **Identity cards in-game** | `HeroZone`, hero select, deck builder, `CardView`                               | **Unverified.** They should go through `localArtUrl`; M4 proves it.                                                                                                                                  |

So MCD work is: a `description` field, an on/off setting that the art lookup honors, a browse view, a test of the identity path, an in-game verification, and documentation. The pack format otherwise needs no change.

## 3. Copyright and distribution rules (binding for every step)

1. **No images in git, ever, in MCD.** Not the originals, not the converted PNGs, not thumbnails, not contact sheets. `leak:check` stays green with no allowlist entry.
2. **No screenshots** in the repository, the PR, issues, comments or docs. Visual checks are done by the owner on the PC; any report back is written in words.
3. **Test images are synthetic.** MCD tests generate coloured rectangles in a temp folder at run time. No fan art or official art is used as a fixture.
4. **Sources stay out of the pack folder.** Downloads go to `temp/art-sources/corbintm/` (ignored by git) or any folder outside `content/art-packs/`. The loader lists every folder under `content/art-packs/` and reports one without an `art-pack.json` as a failure.
5. **MCD never downloads the set and never ships a converter for it.** Each player gets the files from Corbintm's Drive. The converter repo and the finished pack are private to the owner. Releasing the tool later is a separate decision (section 10).
6. **The watermark stays.** The small headshot top-left is the creator's unifying mark. No step crops it, blurs it or covers it. The browse view shows images whole and unaltered. Trimming bleed must not reach into the watermark (checked in M3 and M4).
7. **Credit is required and visible.** `credit.author` is "Corbintm", `credit.sourceUrl` is the Reddit post, `credit.unofficial` is `true`. The card menu, the pack list and the browse view show it.
8. **Permission.** The set is shared "to print and enjoy", with no license text. Local use by someone who downloaded it from the author is consistent with that. Redistribution is not, so the private repos stay private. The owner will send Corbintm a note later saying MCD can display the set from local files and never ships it. This does not block the work.

## 4. Design

### 4.1 Where each piece lives

| Piece                                                                       | Repository                            | Why                                                                                         |
| :-------------------------------------------------------------------------- | :------------------------------------ | :------------------------------------------------------------------------------------------ |
| Art pack format, loader, lookup, route, leak guard                          | MCD (exists)                          | The contract every pack author honors.                                                      |
| `description` field, on/off switch, browse view, identity tests, creator docs, ADR amendment | MCD                                   | Features of the game and the contract.                                                      |
| Converter (PDF extraction, sheets, bleed, fold panels to per-card PNGs), recipe, coverage    | **New dedicated private repo** (4.4)  | Specific to one fan set's packaging; needs Python image and PDF libraries MCD should not carry. |
| Finished pack `content/art-packs/corbintm_alt_heroes/`                      | `mcd-private-content` (data only)     | Already the home of art packs (`assets:push`).                                              |
| Downloaded originals                                                        | Nowhere in git (`temp/`)              | Not ours to keep or share.                                                                  |

### 4.2 Source inventory comes first for the pack (M0)

The pack work depends on facts only the Drive folder can give. M0 collects them in one pass on the PC (Remote Control session, text output only):

- File list: names, extensions, pixel sizes, DPI, colour mode (PNG, JPG, **PDF**).
- Shape of each file: one card, a print sheet with several cards, a foldable panel strip, or a PrintPlayGames template page. For a PDF: pages, and whether each page holds an embedded raster image (extractable as is) or vector content (must be rendered).
- Bleed: the margin between the file edge and the cut line, in pixels, per file type. Derived from the sizes (a 2.5 x 3.5 in card at 300 dpi is 750 x 1050 px; extra on each side is bleed), not assumed.
- How the third faces (Ant-Man, Wasp, Angel) are laid out and whether any panel is rotated or mirrored.
- How Ironheart's three identity cards are named.
- Which heroes the set covers (the post says Core Box to Civil War Box).

The assumptions in section 9 are replaced with these facts before M3 starts. The MCD feature work (M1, M2) does not wait for M0.

### 4.3 Mapping images to card codes

The ground truth is the loaded identity cards (`type_code` `hero` or `alter_ego`), not file names, and not an assumed `a`/`b` pairing. Today that is 145 codes over about 70 heroes. Examples that break a naive rule:

- Ironheart has three identity versions: `29001a/b`, `29002a/b`, `29003a/b`.
- Ant-Man, Wasp and Angel have a third face with its own code: `12001c`, `13001c`, `42001c` (Archangel).
- SP//dr's identity is `31001a` (hero) and `31002a` (alter-ego); their `b` codes are a support and an upgrade, not identity sides.

A pack maps each of these codes to a file named after the code (`29002a.png`), which satisfies `CARD_ART_FILE_PATTERN` and makes the pack easy to audit.

### 4.4 The converter (own private repo, outline only)

A new private repository, proposed name `SteveRodrigue/mcd-art-pack-tools`. Reasons it is separate from `mcd-private-content`: that repo is data that `assets:push` commits wholesale with `git add .`, and mixing a code project into it would put dependency folders and tool history in the same place as the art. A dedicated repo has its own history, tests and CI, and can be made public later without exposing the art. Its design belongs to that repo; this plan fixes only what MCD needs from it:

- **Language:** Python.
- **PDF input:** extract the embedded raster image when a page holds one (lossless, no resampling); render the page only when it is vector content. Library choice must stay license-friendly for a future public release: prefer `pypdfium2` (Apache-2.0/BSD) or `pikepdf` (MPL-2.0) over PyMuPDF (AGPL-3.0). Pillow for crop, split, rotate and resize.
- **Input:** the downloaded folder, a recipe (file or page to card codes, bleed to trim, grid split, rotation), and the path to an MCD checkout.
- **Output:** `<out>/<pack id>/` with one `<code>.png` per mapped identity card and an `art-pack.json` including the `description`. `<out>` is the central folder `~/.mcd/private-content/content/art-packs`, so `assets:push` stores the finished pack and `assets:pull` shares it with every worktree.
- **Reads MCD only as data:** the card JSON under `content/packs/*/cards/*.json` for coverage, and `src/data/packs/art-pack.schema.json` to validate the manifest (plain JSON Schema). It imports no MCD code.
- **Checks:** every recipe code exists in the loaded cards; no code mapped twice; output aspect ratio matches the card's orientation; trim never reaches the watermark (default safe margin 5% of the width); prints which identity codes have no art.
- **Tests:** generated images and a generated PDF only.
- **Ignored folders:** `.venv` and caches in its own `.gitignore`.
- **Creating the repository** is the owner's step (this session cannot create repositories). After it exists, it is added to the project and the work happens there.

### 4.5 Special cases, one by one

| Case                            | Handling                                                                                                                                                                                                                                                                                                                         |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero and alter-ego              | Two codes (`NNNNNa` and `NNNNNb`). The existing lookup already treats them as separate cards.                                                                                                                                                                                                                                    |
| Several identity cards per hero | Each version has its own code pair. The recipe maps each by file; no engine change. M4 checks that each version is selectable and shows its own image.                                                                                                                                                                           |
| Triple-sided heroes             | The third face is a normal card code (`12001c`, `13001c`, `42001c`). The converter splits the fold strip into three panels. M4 checks which of the three the game can show; if the engine never displays a `c` face today, the art is still mapped (ready for later), it appears in the browse view, and a GitHub issue is opened for the missing form change. |
| Full-bleed print sheets         | The converter trims bleed by the pixel count measured in M0 and splits sheets by grid. Output is the cut-line card, so the app's own rounded corners and border do not show a stray margin.                                                                                                                                       |
| Watermark                       | Untouched (rule 6).                                                                                                                                                                                                                                                                                                              |
| Orientation                     | The pack image must have the shape the app expects for the card (ADR-0011). M0/M4 confirm whether identity cards are portrait in the app, from the loaded data.                                                                                                                                                                  |
| Heroes missing from the set     | Keep official art. Never an error.                                                                                                                                                                                                                                                                                               |
| Two packs list the same card    | Unchanged rule, now applied to enabled packs only: the first enabled pack by folder name wins. Switching one off lets the next one show.                                                                                                                                                                                        |
| Card Editor                     | Still shows official art by design (ADR-0093, decision 10). No change. The browse view is not the editor and shows pack art.                                                                                                                                                                                                      |
| Worktrees and agents            | The finished pack lives in the central folder; `assets:pull` junctions it into every worktree. The on/off choice is per browser, not per worktree.                                                                                                                                                                               |

## 5. MCD feature: art pack list, switch and browse

### 5.1 Manifest: `description`

`art-pack.json` gains `description`, a required string of 1 to 300 characters: what the pack contains and when to use it ("Alternate identity cards for every hero from the Core Box to the Civil War Box, by Corbintm. Replaces hero and alter-ego art."). The Zod schema in `art-pack.ts` is the source; `schema:generate` regenerates `art-pack.schema.json`. Required, not optional, because the owner wants every pack to explain itself, and art packs are two days old with a single known pack (Ultron tokens, whose JSON gets one added line in the private data repo). No shim for packs without it: such a pack fails to load with a clear message on the Content screen.

### 5.2 The switch

- **State:** `disabledArtPacks: string[]` (pack ids) in the existing `GameSettings`, persisted by the existing `GameSettingsProvider` in `localStorage`. Disabled, not enabled, so a newly installed pack is on by default, which keeps "found means used" as the default and Ultron behaves as today. An unknown id in the list is ignored.
- **Honored in one place:** `card-art.ts` builds its index from the loaded art packs. It gets the disabled ids from a small non-React holder (the lookup is a plain function used outside React); the settings provider writes to it whenever the setting changes, and the index rebuilds when either the content or the disabled set changes. `artPackArt`, `artPackHasStatImages`, `artPackImageUrls` and `localArtUrl` all go through the same index, so no call site changes. A disabled pack's images are not preloaded.
- **Live update:** the holder exposes a subscription (`useSyncExternalStore`), so `useCardArt` and `CardView` re-render when the switch flips, without a restart and without touching `GameState`. This is the one part of the design that touches how the lookup is read by React, so it gets its own tests (5.5).
- **Tokens:** switching off a pack that provides scenario tokens (Ultron Drone) falls back to the labelled card back, which the fallback path already handles.

### 5.3 Where it appears

One component, `ArtPackSettings`, rendered in two places: the in-game **Options menu** (the configuration menu, as a new `SettingPanel` section "Art packs") and the **Content screen** (which today lists art packs and their problems and is reachable without starting a game). Each row shows name, description, credit (author, "(unofficial)", link to the source), image count, a switch and a **Browse** button. The existing problem list (invalid packs, warnings) stays on the Content screen and is linked from the row of a pack that has warnings. When no art pack is installed, the section says so and points to the creator guide; it never shows an error.

### 5.4 Browse view

A modal opened by **Browse** shows every image of the pack, whether or not the pack is on:

- Grouped by card, each tile labelled with the card code, the card's name and side (from the loaded card data), and, for stat images, the printed ATK and hit points. A code that no loaded card owns is shown with its code only and a warning mark (the loader already warns about it).
- Images load lazily from the existing `/card-art/_art-<id>/<file>.png` route, through the same cache as in-game art, so a pack of 145 images does not load at once.
- Clicking a tile enlarges the image (the existing card zoom behaviour where it fits, otherwise a simple enlarged view in the same modal). The image is shown whole and unaltered (rule 6).
- Credit and description sit at the top. A text filter by card name or code is included because the Corbintm pack has about 145 images; nothing else (sorting, favourites) is added.
- A broken image shows a placeholder tile with its file name, not an error.

### 5.5 Engine, schema and other changes

- `src/engine`: **none.**
- Art pack schema: `description` added (5.1). Creator docs and the generated schema are updated in the same change.
- Everything else is UI and data-layer code in `src/data/content/card-art.ts`, `src/ui/context/*`, `src/ui/components/setup/ContentScreen.tsx`, `OptionsMenu.tsx` and a new `ArtPackSettings` plus browse modal.

Identity-card risks that M4 checks (any gap is fixed in its path, not deferred):

- Hero select, `HeroZone`, board zoom, the deck builder list and any identity thumbnail all call `localArtUrl`/`useCardArt` with the identity's own code.
- Flip between hero and alter-ego swaps the image without a blank frame (pack images are not preloaded like scenario tokens; if it flashes, preload the identity codes at game start).
- On-card UI (badges, name plates, damage counters) does not cover the watermark in a way that matters.
- A missing or broken image falls back to official art (existing behaviour, retested for an identity card).

## 6. Tests in MCD (written first)

All use synthetic images generated at run time in a temp folder, or no images at all (URLs only).

- **Manifest:** `description` required, trimmed, 1 to 300 characters; the generated JSON schema matches the Zod schema (the existing schema guard).
- **Lookup:** with two synthetic packs listing the same card, the first enabled wins; disabling it lets the second win; disabling both returns `undefined`; an unknown id in the disabled list is ignored; stat-image selection and preloading skip a disabled pack.
- **Identity cards:** with a synthetic pack covering `29001a`, `29002b`, `12001c` and `31001a`, `artPackArt(code)` returns the pack URL for each, and an uncovered hero returns `undefined`.
- **Settings:** `disabledArtPacks` persists and reloads from `localStorage`; a failing `localStorage` leaves the default (all on) and does not throw.
- **UI:** `ArtPackSettings` lists packs with description and credit, the switch flips the setting, a `CardView` for a covered card changes its image URL when the switch flips (and falls back to official art when the pack is off or the image errors), **Browse** opens the modal with one tile per image and the card's name, the filter narrows the tiles, and the empty state shows when no pack is installed.
- Existing guards keep running: `leak:check`, `pack:validate`, `docs:check`, `schema:generate`. No allowlist entry is added.

## 7. Milestones

| #  | Step                                                                                                                                                                    | Where                  | Done when                                                                                   |
| :- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- | :------------------------------------------------------------------------------------------ |
| M0 | Download the Drive folder to `temp/art-sources/corbintm/`; produce the inventory (4.2); replace the assumptions in section 9. The owner creates the converter repo.     | Steve's PC (RC)        | Inventory posted in words; section 9 updated; repo exists and is added to the project.      |
| M1 | MCD: `description` field, switch state and lookup change, identity tests. Failing tests first.                                                                          | MCD (cloud)            | Section 6 tests green; `verify` green; no tracked image.                                    |
| M2 | MCD: `ArtPackSettings` in Options menu and Content screen, browse modal, tests, creator docs for the new field and the switch.                                          | MCD (cloud, PC check)  | UI tests green; owner sees the list, switch and browse with the Ultron pack.                |
| M3 | Converter repo: Python tool, recipe, PDF extraction, tests. Then build the Corbintm pack from the real files, drive coverage to every covered hero, review the mapping with the owner. | Tool repo, Steve's PC  | Zero unknown codes; owner confirms the mapping by eye (contact sheet or the new browse view). |
| M4 | In-game check (list below). Fix what it finds in its path, in MCD.                                                                                                      | Steve's PC (RC)        | All items pass; findings fixed or issued.                                                   |
| M5 | MCD docs finished, ADR amendment, changelog fragment, `assets:push` of the pack, delete this plan file in the delivering commit, close #618.                            | Cloud, PC              | PR merged ("Merge" from Steve); #618 closed with `Fixes #618`.                              |

M1 and M2 can ship as their own pull requests before the pack exists, since they are useful with the Ultron pack alone. #618 closes with the last one.

**M4 checklist** (a person looks; nothing is captured):

1. Options menu and Content screen list the packs with description and credit; switch off and on changes art live in a running game; the choice survives a reload.
2. Browse shows every image of the Corbintm pack with the right card names, filter works, enlarged view is whole and unaltered.
3. Spider-Man (plain pair): hero select, board, zoom, flip to alter-ego and back.
4. Ironheart: all three versions are selectable and each shows its own art in both forms.
5. Ant-Man, Wasp, Angel: both identity sides, and the third face wherever the game can show it.
6. A hero the set does not cover, a game with the pack off, and a game with the folder removed: official art, no errors. With the Ultron pack off, the Drone shows its labelled card back.
7. Content screen shows zero warnings for the pack; Card Editor still official; a deliberately renamed PNG falls back cleanly.

## 8. Documentation (MCD)

- `docs/creators/art-packs.md`:
  - New field `description` in the format table and the example.
  - New section **Turning packs on and off and browsing them**.
  - New section **Hero and alter-ego art**: how identity codes work (pairs, several versions, third faces, SP//dr), the shape and size an image should have, bleed already removed, the watermark and credit expectation, and a statement that MCD ships no converter: make the PNGs by hand or with your own tooling. Corbintm's set appears only as the worked example, like the Ultron tokens, with no images.
  - **Clearing the image cache** (needed after replacing an image, because the browser keeps images for a long time): in the browser's developer tools, open Application, then Storage, then Cache storage, delete the entry `mcd-card-art-v2`, and reload. The page also says the other way to avoid it, a new file name.
- ADR-0093: amendment (not a new ADR). Decision 2 changes from "found means used, no picker or saved setting" to "found means available, used unless switched off, default on, stored per browser"; adds the `description` requirement, the browse view, that conversion tooling is deliberately outside MCD, and the permission position (rule 8).
- `docs/backlog/teamwork_status_and_next_target.md`: update the queue.
- `changes/unreleased/618-art-pack-switch-and-hero-art.md` (type `Added`).
- This plan file is deleted in the commit that delivers the work.

## 9. Assumptions to verify in M0

- The Drive holds individual images per identity side, and print sheets built on PrintPlayGames templates (the post says both), and some of it is PDF.
- Bleed is uniform on all four sides.
- Tri-fold faces sit side by side in one strip, in an order that needs a lookup (not necessarily a, b, c).
- Identity cards are portrait in the app.
- The set covers Core through the Civil War heroes; later heroes in the repository stay official.

## 10. Parked (not needed to prove the engine)

- Releasing the converter publicly. It would need a license decision on the tool, a statement that it ships no fan art, and the license check on its PDF library. Not planned now.
- An MCD command that checks an art pack's PNGs against the loaded cards. The loader already validates the manifest; add a checker only if pack authors ask.
- A "Clear art cache" button in the app (documented manual step instead, owner decision).
- Choosing between several packs for the same card (the first enabled wins). Add a per-card or per-hero picker only if two packs ever overlap in practice.
- Per-hero or per-card on/off inside a pack.
- Browser or desktop import of the Drive zip (M11/Tauri are parked).
- Art for non-identity cards, localisation of art, replacing card backs.
- Automatic watermark handling of any kind (rule 6).

## 11. Debt removed

None found. Looked at: `art-pack.ts`, `art-pack.schema.json`, `card-art.ts`, `image-cache.ts`, `card-art-middleware.ts`, `private-assets.ts`, `ContentScreen.tsx`, `GameSettingsProvider.tsx`, the creator guide and ADR-0093. ADR-0093 decision 2 is superseded by the switch and is rewritten, not left contradicting the code. The only other candidate is the `preloadArtPackImages` call that today covers scenario tokens only; it is changed in M4 if the flip flashes, not before.

## 12. Open decisions for the owner

| # | Decision                                                                                                                                                                              | Recommendation                                                 |
| :- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------- |
| 1 | Create the converter repo `SteveRodrigue/mcd-art-pack-tools` (private). I cannot create repositories from here; once it exists I can be given access to it.                           | Yes, that name; private now, public-able later.                |
| 2 | Is `description` required (a pack without one fails to load) or optional?                                                                                                            | Required.                                                      |
| 3 | A newly found pack is on by default (the switch stores what is off).                                                                                                                  | On by default.                                                 |
| 4 | Show the list in both the in-game Options menu and the Content screen (one component, two places), or only the Options menu.                                                          | Both; the Content screen is reachable without starting a game. |
| 5 | The on/off choice is stored in the browser (`localStorage`), so it is per browser and not shared across worktrees or devices.                                                          | Yes; it is the existing settings mechanism.                    |
| 6 | Two packs listing the same card: the first enabled by folder name wins, no per-card picker (parked).                                                                                  | Yes.                                                           |
