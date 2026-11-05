# Plan: Corbintm's alternate-art hero set as an art pack (Issue #618)

> **Status:** Draft for owner review. Nothing is implemented. Milestone: Gate 2 (as the issue).
> **Goal of the issue:** prove that the art pack engine (ADR-0093) works well with Hero and Alter-Ego cards, using a fan-made set that has an alternate identity card for every hero.
> **Source:** Corbintm's set on r/marvelchampionslcg, shared through Google Drive (links in the issue). The cloud sandbox cannot reach Reddit or Drive, so the first step is an inventory on the owner's PC (M0).

## 1. In-Game Scenario

**Setup.** The player has installed the pack `content/art-packs/corbintm_alt_heroes/` and starts a game with Ironheart (identity set 3), Ant-Man and Angel, one after the other.

**What the player does.** Opens Hero Select, picks the hero, starts a mission, plays a turn, flips to alter-ego and back, and (for the triple-sided heroes) changes to the third form if the engine offers it.

**Today.** Every identity card shows MarvelCDB art. Only the Ultron Drone tokens come from an art pack.

**After the change.** Each identity side shows Corbintm's card: hero side, alter-ego side, and the third face of Ant-Man, Wasp and Angel. Ironheart's three identity versions each show their own image. A hero the set does not cover keeps its official art. With the folder deleted, nothing changes from today.

**Why by the rules.** Art is cosmetic (ADR-0093, driver 3). No rule, stat, seed or saved game changes, so no rules analysis is needed.

## 2. What exists, and what is missing

Read in the repository on `main` (checked 2026-11-05):

| Piece                       | Where                                                                           | Status for this job                                                                                                                                      |
| :-------------------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format and loader           | `src/data/packs/art-pack.ts`, `src/data/content/loader.ts`                      | Done. One entry per card code, PNG only, `id` 2 to 32 chars.                                                                                             |
| Lookup and route            | `src/data/content/card-art.ts`, `src/tools/card-art-middleware.ts`              | Done. `localArtUrl` is the single path; any code can have an image, including `a`, `b` and `c` sides.                                                    |
| Never committed             | `.gitignore` (`content/art-packs/`), `tools/audit/leak-guard.ts` (`image` rule) | Done. Any tracked PNG or JPG fails `leak:check`.                                                                                                         |
| Private backup and sharing  | `scripts/private-assets.ts` (`assets:pull`, `assets:push`)                      | Done. Moves `content/art-packs/` to and from `SteveRodrigue/mcd-private-content`, junctions it into worktrees.                                           |
| Tested on                   | Ultron Drone tokens (ADR-0093)                                                  | Tokens only. No identity card has ever used it.                                                                                                          |
| **Image tooling**           | none                                                                            | **Missing.** `package.json` has no image library. The pack format needs final per-card PNGs, so sheets, bleed and fold panels must be turned into those. |
| **Code to image mapping**   | none                                                                            | **Missing.** Nothing says which file is which identity card.                                                                                             |
| **Coverage check**          | none                                                                            | **Missing.** Nothing says which identity cards have no art, or which files are unused.                                                                   |
| **Identity cards in-game**  | `HeroZone`, hero select, deck builder, `CardView`                               | **Unverified.** They should go through `localArtUrl`; M3 proves it.                                                                                      |

The format itself needs no change. The work is a conversion tool, a mapping, a coverage report, an in-game check and documentation.

## 3. Copyright and distribution rules (binding for every step)

1. **No images in git, ever.** Not the originals, not the converted PNGs, not thumbnails, not contact sheets. `leak:check` stays green with no allowlist entry.
2. **No screenshots** in the repository, the PR, issues, comments or docs. Visual checks are done by the owner on the PC; any report back is written in words.
3. **Test images are synthetic.** Tests generate coloured rectangles in a temp folder at run time. No fan art or official art is used as a fixture.
4. **Sources stay out of the pack folder.** Downloads go to `temp/art-sources/corbintm/` (ignored by git, skipped by lint and prettier). The loader lists every folder under `content/art-packs/` and reports one without an `art-pack.json` as a failure, so downloads must not go there.
5. **MCD never downloads the set.** Each player gets the files from Corbintm's Drive and converts them locally. The repository holds the converter and a recipe (file names, crop numbers, card codes), which contain no pixels.
6. **The watermark stays.** The small headshot top-left is the creator's unifying mark. The converter never crops it, blurs it or covers it. Cropping bleed must not reach into it (checked in M3).
7. **Credit is required and visible.** `credit.author` is "Corbintm", `credit.sourceUrl` is the Reddit post, `credit.unofficial` is `true`. The card menu and Content screen already show it.
8. **Permission.** The set is shared "to print and enjoy", with no license text. Local use by someone who downloaded it from the author is consistent with that. Redistribution is not, so the private backup repo stays private. Recommendation: Steve sends Corbintm one message (Reddit or Discord) saying MCD can display the set from local files and never ships it. This does not block the work.

## 4. Design

### 4.1 Source inventory comes first (M0)

Everything below depends on facts only the Drive folder can give. M0 collects them in one pass on the PC (Remote Control session, text output only):

- File list: names, extensions, pixel sizes, DPI, colour mode (PNG, JPG, PDF?).
- Shape of each file: one card, a print sheet with several cards, a foldable panel strip, or a PrintPlayGames template page.
- Bleed: the margin between the file edge and the cut line, in pixels, per file type. Derived from the sizes (a 2.5 x 3.5 in card at 300 dpi is 750 x 1050 px; extra on each side is bleed), not assumed.
- How the third faces (Ant-Man, Wasp, Angel) are laid out and whether any panel is rotated or mirrored.
- How Ironheart's three identity cards are named.
- Which heroes the set covers (the post says Core Box to Civil War Box).
- Whether the originals are PDFs. If so, M1 adds a rasterize step (see open decision 6).

The assumptions listed in section 8 are replaced with these facts before M1 starts.

### 4.2 Mapping images to card codes

The ground truth is the loaded identity cards (`type_code` `hero` or `alter_ego`), not file names, and not an assumed `a`/`b` pairing. Today that is 145 codes over about 70 heroes. Examples that break a naive rule:

- Ironheart has three identity versions: `29001a/b`, `29002a/b`, `29003a/b`.
- Ant-Man, Wasp and Angel have a third face with its own code: `12001c`, `13001c`, `42001c` (Archangel).
- SP//dr's identity is `31001a` (hero) and `31002a` (alter-ego); their `b` codes are a support and an upgrade, not identity sides.

The converter is driven by a **recipe** file, committed at `tools/art-recipes/corbintm_alt_heroes.json`:

```json
{
  "id": "corbintm_alt_heroes",
  "name": "Corbintm alternate art heroes",
  "credit": {
    "author": "Corbintm",
    "sourceUrl": "<Reddit post URL from the issue>",
    "unofficial": true
  },
  "output": { "maxWidth": 600 },
  "sources": {
    "ironheart_2.png": {
      "trim": { "left": 38, "top": 38, "right": 38, "bottom": 38 },
      "cards": [{ "code": "29002a" }]
    },
    "ant_man_trifold.png": {
      "split": { "columns": 3 },
      "cards": [{ "code": "12001a" }, { "code": "12001b" }, { "code": "12001c" }]
    }
  }
}
```

(The numbers and names above are placeholders; M0 supplies the real ones.) A source is one of three shapes: a single card, a grid (`columns` x `rows`, listed in reading order, so full-bleed sheets are split by position), or explicit rectangles when a template is irregular. Each shape accepts `trim` (bleed), `rotate` (90, 180 or 270) and `flip`. The recipe generator can pre-fill a skeleton from the loaded identity cards (code, hero name, set), so the human only types file names.

### 4.3 The converter: `npm run artpack:build -- <recipe> <sourceDir>`

New script `scripts/art-pack-build.ts`, local only:

1. Parses and validates the recipe (zod, strict, same style as `ArtPackManifestSchema`).
2. For each source file: trims bleed, splits into panels, rotates or flips as declared, resizes to `output.maxWidth` keeping the aspect ratio, writes `<code>.png` into `content/art-packs/<id>/`. File names are the card codes, which satisfy `CARD_ART_FILE_PATTERN` and keep the one-file-per-code rule easy to audit.
3. Writes `art-pack.json` from the recipe's credit and the files it produced. The result is validated with `ArtPackManifestSchema` before it is saved.
4. Prints a **coverage report** (also available alone as `--report`): every loaded identity code with its hero name and set, marked mapped or missing; recipe entries whose code does not exist; source files the recipe never uses; two sources claiming the same code. Exit code is non-zero for an unknown code, a duplicate, or a missing source file. Missing coverage is a warning, because the set may not cover every hero in the repository.
5. Optional `--contact-sheet` writes `temp/art-sources/<id>/contact.html`: each converted image under its code and hero name, so the owner can check the mapping by eye in one scroll. It lives in ignored `temp/` and is never attached anywhere.
6. Is idempotent: rebuilding replaces the pack folder content. A replaced image keeps its name, and the ADR notes the browser keeps images for a long time, so the build prints a reminder to clear the card-art cache storage or version the file names (open decision 7).

Dependency: `sharp` as a `devDependency` (prebuilt binaries for Windows, macOS and Linux). It is used by this script only and never imported from `src/`. Owner approval needed (open decision 1).

Image size: the maximum width comes from the largest on-screen size of an identity card (zoom or hero select) times a device pixel ratio of 2. Expected near 600 px; measured in M0/M3 rather than guessed. About 145 PNG files at that size is well under 150 MB.

### 4.4 Special cases, one by one

| Case                                   | Handling                                                                                                                                                                                                                                                                                                                       |
| :------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero and alter-ego                     | Two codes (`NNNNNa` and `NNNNNb`). The existing lookup already treats them as separate cards.                                                                                                                                                                                                                                  |
| Several identity cards per hero        | Each version has its own code pair. The recipe maps each by file; no engine change. M3 checks that each version is selectable and shows its own image.                                                                                                                                                                         |
| Triple-sided heroes                    | The third face is a normal card code (`12001c`, `13001c`, `42001c`). The recipe splits the fold strip into three panels. M3 checks which of the three the game can show; if the engine never displays a `c` face today, the art is still mapped (so it is ready) and a GitHub issue is opened for the missing form change. |
| Full-bleed print sheets                | `trim` removes the bleed by pixel count taken from M0; `split` cuts sheets by grid. Output is the cut-line card, so the app's own rounded corners and border do not show a stray margin.                                                                                                                                       |
| Watermark                              | Untouched (rule 6). The trim values are chosen from the bleed measured in M0, so they cannot reach the headshot, and a unit test asserts trim never exceeds a configurable safe margin (default 5% of the width).                                                                                                              |
| Orientation                            | The pack image must have the shape the app expects for the card (ADR-0011). The importer compares the output aspect ratio with the card's `isLandscape` and fails the build on a mismatch. This also catches a panel that came out rotated.                                                                                |
| Heroes missing from the set            | Keep official art. Reported by the coverage step, never an error.                                                                                                                                                                                                                                                              |
| Card Editor                            | Still shows official art by design (ADR-0093, decision 10). No change.                                                                                                                                                                                                                                                         |
| Worktrees and agents                   | `assets:push` stores the finished pack in the private repo; `assets:pull` junctions it into every worktree. Sources stay in `temp/art-sources/`, not synced.                                                                                                                                                                   |

## 5. Engine, schema and UI changes

Expected: **none** in `src/engine`, none in the art pack schema. The risk is in the UI, so M3 is a verification gate, and any gap found there is fixed in its path (No Tech Debt Mandate), not deferred. Things M3 checks that could expose a gap:

- Hero select, `HeroZone`, board zoom, the deck builder list and any identity thumbnail all call `localArtUrl`/`useCardArt` with the identity's own code.
- Flip between hero and alter-ego swaps the image without a blank frame (the pack image is not preloaded the way scenario tokens are; if it flashes, add the identity codes to `preloadArtPackImages` at game start).
- On-card UI (badges, name plates, damage counters) does not cover the watermark in a way that matters.
- A missing or broken image falls back to official art (existing behaviour, retested for an identity card).

## 6. Tests (written first)

All use synthetic images generated at run time in a temp folder.

- `tests/tools/art-pack-build.test.ts`: recipe validation (unknown key, bad `trim`, duplicate code, unknown code fails); trim, split-by-grid, rotate and flip give the expected pixel positions (coloured quadrants); output is within `maxWidth`; produced `art-pack.json` passes `ArtPackManifestSchema`; aspect ratio mismatch fails; coverage report lists missing, unknown, unused and duplicate entries.
- `tests/data/art-pack-identities.test.ts`: with a synthetic pack covering `29001a`, `29002b`, `12001c` and `31001a`, `artPackArt(code)` returns the pack URL for each, and an uncovered hero returns `undefined`.
- UI: an identity `CardView` shows the pack URL, and falls back to the official URL when the image errors (extends the existing art pack tests).
- Guards that already exist keep running: `leak:check`, `pack:validate`, docs check. No allowlist entry is added.

## 7. Milestones

| #  | Step                                                                                                                                                                                              | Where           | Done when                                                                      |
| :- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------- | :----------------------------------------------------------------------------- |
| M0 | Download the Drive folder to `temp/art-sources/corbintm/`; produce the inventory (4.1); replace the assumptions in section 8. Steve answers the open decisions below.                              | Steve's PC (RC) | Inventory posted in words; section 8 updated.                                  |
| M1 | Failing tests, then `scripts/art-pack-build.ts`, recipe schema, coverage report, `sharp` devDependency, npm script. Synthetic images only.                                                        | Cloud or PC     | Tests green; `npm run verify` green; no tracked image.                         |
| M2 | Write the recipe for the real set, build the pack, drive coverage to every covered hero. Review the contact sheet with Steve.                                                                     | Steve's PC      | Coverage report shows zero unknown codes; Steve confirms the mapping by eye.   |
| M3 | In-game check (checklist below). Fix what it finds in its path.                                                                                                                              | Steve's PC (RC) | All items pass; findings fixed or issued.                                      |
| M4 | Docs and ADR amendment, changelog fragment, `assets:push` of the finished pack, delete this plan file in the delivering commit, close #618.                                                       | Cloud           | PR merged ("Merge" from Steve); #618 closed with `Fixes #618`.                 |

**M3 checklist** (a person looks; nothing is captured):

1. Spider-Man (plain pair): hero select, board, zoom, flip to alter-ego and back.
2. Ironheart: all three versions are selectable and each shows its own art in both forms.
3. Ant-Man, Wasp, Angel: both identity sides, and the third face wherever the game can show it.
4. A hero the set does not cover, and a game with the folder removed: official art, no errors.
5. Content screen lists the pack, credit and zero warnings; Card Editor still official; a deliberately renamed PNG falls back cleanly.

## 8. Assumptions to verify in M0

- The Drive holds individual images per identity side, and print sheets built on PrintPlayGames templates (the post says both).
- Files are raster images, not PDFs only.
- Bleed is uniform on all four sides.
- Tri-fold faces sit side by side in one strip, in an order that needs a lookup (not necessarily a, b, c).
- Identity cards are portrait in the app; the importer checks this per card from the loaded data.
- The set covers Core through the Civil War heroes; later heroes in the repository stay official.

## 9. Documentation

- `docs/creators/art-packs.md`: new section **Hero and alter-ego art** (code pairs, the three-version and three-face cases, the `trim`/`split` recipe, the watermark and credit rule, and a pointer to the converter). It stays generic: it describes the tool, and names Corbintm's set only as the worked example, like the Ultron tokens.
- ADR-0093: short amendment (not a new ADR) recording that identity cards are supported, the converter and recipe exist, the images stay local, and the permission position (rule 8).
- `docs/backlog/teamwork_status_and_next_target.md`: update the queue.
- `changes/unreleased/618-corbintm-alt-hero-art.md` (type `Added`).
- This plan file is deleted in the commit that delivers the work.

## 10. Parked (not needed to prove the engine)

- A Content-screen switch to turn a pack off, or a choice between several packs for one card (found means used stays, ADR-0093 decision 2).
- Browser or desktop import of the Drive zip (M11/Tauri are parked).
- Art for non-identity cards, localisation of art, replacing card backs.
- Automatic watermark handling of any kind (rule 6).
- Rasterizing PDFs, unless M0 shows PDF-only sources.

## 11. Debt removed

None found. Looked at: `art-pack.ts`, `art-pack.schema.json`, `card-art.ts`, `image-cache.ts`, `card-art-middleware.ts`, `private-assets.ts`, the creator guide and ADR-0093. The only candidate is the `preloadArtPackImages` call that today covers scenario tokens only; it is changed in M3 if the flip flashes, not before.

## 12. Open decisions for the owner

| # | Decision | Recommendation |
| :- | :------- | :------------- |
| 1 | Add `sharp` as a `devDependency` for the converter. Alternative: pure JavaScript (`pngjs` plus `jpeg-js`), slower and no resize quality. | Yes, `sharp`. |
| 2 | Commit the recipe (file names, crop numbers, card codes; no pixels) at `tools/art-recipes/`, so anyone with the Drive can rebuild the pack. Alternative: keep it only in the private repo. | Commit it. |
| 3 | Send Corbintm one message asking if local display is fine (section 3, rule 8). | Yes, in parallel; not blocking. |
| 4 | Keep the finished pack in the private repo via `assets:push` as a backup. Sources stay only in `temp/`. | Yes. |
| 5 | Keep "found means used": the pack replaces official art for every covered hero with no off switch. | Yes for now; park the switch until it hurts. |
| 6 | If the Drive turns out PDF-only, add a rasterize step (`pdftoppm` or a PDF library) in M1. | Decide after M0. |
| 7 | Cache busting: version file names (`29001a.v2.png` is rejected by the pattern, so `29001a_v2.png`) or ask the user to clear the browser cache after a rebuild. | Document the clear-cache step; version names only if it keeps biting. |
