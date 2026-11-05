# Plan: Corbintm's alternate-art hero set as an art pack (Issue #618)

> **Status:** Draft v2 for owner review. Nothing is implemented. Milestone: Gate 2 (as the issue).
> **Goal of the issue:** prove that the art pack engine (ADR-0093) works well with Hero and Alter-Ego cards, using a fan-made set that has an alternate identity card for every hero.
> **Source:** Corbintm's set on r/marvelchampionslcg, shared through Google Drive (links in the issue). The cloud sandbox cannot reach Reddit or Drive, so the first step is an inventory on the owner's PC (M0).
> **Change from v1 (owner decision, 2026-11-05):** the converter that turns the fan files into a pack lives in the private repo `SteveRodrigue/mcd-private-content`, not in MCD. MCD defines and documents the pack format and proves the engine honors it; whoever makes a pack builds it by hand or with their own tooling. MCD gains no converter code, no image dependency and no recipe.

## 1. In-Game Scenario

**Setup.** The player has installed the pack `content/art-packs/corbintm_alt_heroes/` and starts a game with Ironheart (identity set 3), Ant-Man and Angel, one after the other.

**What the player does.** Opens Hero Select, picks the hero, starts a mission, plays a turn, flips to alter-ego and back, and (for the triple-sided heroes) changes to the third form if the engine offers it.

**Today.** Every identity card shows MarvelCDB art. Only the Ultron Drone tokens come from an art pack.

**After the change.** Each identity side shows Corbintm's card: hero side, alter-ego side, and the third face of Ant-Man, Wasp and Angel. Ironheart's three identity versions each show their own image. A hero the set does not cover keeps its official art. With the folder deleted, nothing changes from today.

**Why by the rules.** Art is cosmetic (ADR-0093, driver 3). No rule, stat, seed or saved game changes, so no rules analysis is needed.

## 2. What exists, and what is missing

Read in the repository on `main` (checked 2026-11-05):

| Piece                      | Where                                                                           | Status for this job                                                                                                                                   |
| :------------------------- | :------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format and loader          | `src/data/packs/art-pack.ts`, `src/data/content/loader.ts`                      | Done. One entry per card code, PNG only, `id` 2 to 32 chars. The loader already validates the manifest and lists problems on the Content screen.      |
| Lookup and route           | `src/data/content/card-art.ts`, `src/tools/card-art-middleware.ts`              | Done. `localArtUrl` is the single path; any code can have an image, including `a`, `b` and `c` sides.                                                 |
| Never committed            | `.gitignore` (`content/art-packs/`), `tools/audit/leak-guard.ts` (`image` rule) | Done. Any tracked PNG or JPG fails `leak:check`.                                                                                                      |
| Private backup and sharing | `scripts/private-assets.ts` (`assets:pull`, `assets:push`)                      | Done. The central folder `~/.mcd/private-content` is a git clone of the private repo; `assets:push` runs `git add .` there; `assets:pull` junctions `content/art-packs/` into every worktree. |
| Tested on                  | Ultron Drone tokens (ADR-0093)                                                  | Tokens only. No identity card has ever used it.                                                                                                       |
| **Identity cards in-game** | `HeroZone`, hero select, deck builder, `CardView`                               | **Unverified.** They should go through `localArtUrl`; M3 proves it.                                                                                   |
| **Creator guidance**       | `docs/creators/art-packs.md`                                                    | **Missing** for identity cards: which codes exist, the shape and size an image must have, the triple-sided and multi-version cases.                   |

The format needs no change. MCD's work is a test of the identity path, an in-game verification, and documentation. Producing the pack is the private repo's job.

## 3. Copyright and distribution rules (binding for every step)

1. **No images in git, ever, in MCD.** Not the originals, not the converted PNGs, not thumbnails, not contact sheets. `leak:check` stays green with no allowlist entry.
2. **No screenshots** in the repository, the PR, issues, comments or docs. Visual checks are done by the owner on the PC; any report back is written in words.
3. **Test images are synthetic.** MCD tests generate coloured rectangles in a temp folder at run time (the PNG bytes are written by the test, with no image library). No fan art or official art is used as a fixture.
4. **Sources stay out of the pack folder.** Downloads go to `temp/art-sources/corbintm/` (ignored by git) or any folder outside `content/art-packs/`. The loader lists every folder under `content/art-packs/` and reports one without an `art-pack.json` as a failure.
5. **MCD never downloads the set and never ships a converter for it.** Each player gets the files from Corbintm's Drive. The private repo holds the converter and the finished pack for the owner's use only. If the tool is released later, that is a separate decision with its own review (see section 10).
6. **The watermark stays.** The small headshot top-left is the creator's unifying mark. No step crops it, blurs it or covers it. Trimming bleed must not reach into it (checked in M2 and M3).
7. **Credit is required and visible.** `credit.author` is "Corbintm", `credit.sourceUrl` is the Reddit post, `credit.unofficial` is `true`. The card menu and Content screen already show it.
8. **Permission.** The set is shared "to print and enjoy", with no license text. Local use by someone who downloaded it from the author is consistent with that. Redistribution is not, so the private repo stays private. Recommendation: Steve sends Corbintm one message (Reddit or Discord) saying MCD can display the set from local files and never ships it. This does not block the work.

## 4. Design

### 4.1 Where each piece lives

| Piece                                                                      | Repository                | Why                                                                                       |
| :------------------------------------------------------------------------- | :------------------------ | :---------------------------------------------------------------------------------------- |
| Art pack format, loader, lookup, route, leak guard                         | MCD (exists)              | The contract every pack author honors.                                                    |
| Creator guidance for identity cards, ADR amendment, tests, in-game check   | MCD                       | Proves and documents the contract.                                                        |
| Converter (sheets, bleed, fold panels to per-card PNGs), recipe, coverage  | `mcd-private-content`     | Specific to one fan set's packaging. Needs an image library MCD should not carry.         |
| Finished pack `content/art-packs/corbintm_alt_heroes/`                     | `mcd-private-content`     | Already the home of art packs (`assets:push`).                                            |
| Downloaded originals                                                       | Nowhere in git (`temp/`)  | Not ours to keep or share.                                                                |

The private repo's converter reads MCD's card data only through a path argument (`--mcd <MCD checkout>`, reading `content/packs/*/cards/*.json`). It imports no MCD code, so the two repos never depend on each other's builds. It validates its output against `src/data/packs/art-pack.schema.json` from that checkout (a JSON Schema, usable from any language), so the pack is checked against the real contract rather than a copy.

### 4.2 Source inventory comes first (M0)

Everything below depends on facts only the Drive folder can give. M0 collects them in one pass on the PC (Remote Control session, text output only):

- File list: names, extensions, pixel sizes, DPI, colour mode (PNG, JPG, PDF?).
- Shape of each file: one card, a print sheet with several cards, a foldable panel strip, or a PrintPlayGames template page.
- Bleed: the margin between the file edge and the cut line, in pixels, per file type. Derived from the sizes (a 2.5 x 3.5 in card at 300 dpi is 750 x 1050 px; extra on each side is bleed), not assumed.
- How the third faces (Ant-Man, Wasp, Angel) are laid out and whether any panel is rotated or mirrored.
- How Ironheart's three identity cards are named.
- Which heroes the set covers (the post says Core Box to Civil War Box).
- Whether the originals are PDFs.

The assumptions in section 8 are replaced with these facts before M1 starts.

### 4.3 Mapping images to card codes

The ground truth is the loaded identity cards (`type_code` `hero` or `alter_ego`), not file names, and not an assumed `a`/`b` pairing. Today that is 145 codes over about 70 heroes. Examples that break a naive rule:

- Ironheart has three identity versions: `29001a/b`, `29002a/b`, `29003a/b`.
- Ant-Man, Wasp and Angel have a third face with its own code: `12001c`, `13001c`, `42001c` (Archangel).
- SP//dr's identity is `31001a` (hero) and `31002a` (alter-ego); their `b` codes are a support and an upgrade, not identity sides.

A pack maps each of these codes to a file named after the code (`29002a.png`), which satisfies `CARD_ART_FILE_PATTERN` and makes the pack easy to audit by eye.

### 4.4 The converter (private repo, outline only)

Its design belongs to that repo; this plan fixes only what MCD needs from it:

- Input: the downloaded folder, a recipe (file name to card codes, bleed to trim, grid split, rotation), and the path to an MCD checkout.
- Output: `content/art-packs/corbintm_alt_heroes/` with one `<code>.png` per mapped identity card and an `art-pack.json` that validates against MCD's schema.
- Checks it must make: every recipe code exists in the loaded cards; no code is mapped twice; output aspect ratio matches the card's orientation in the data; trim never reaches the watermark (default safe margin 5% of the width). It prints which identity codes have no art, so uncovered heroes are visible.
- Optional contact sheet written to an ignored folder (never committed, never attached) so the owner can check the mapping by eye.
- Language and libraries are that repo's choice, not MCD's. Python with Pillow (or PyMuPDF if the sources are PDFs) is a natural fit for crop, split and resize work; Node with `sharp` also works. Whatever it uses, its dependencies stay in that repo, and its environment folder (`node_modules`, `.venv`) is ignored there, because `assets:push` runs `git add .` in the central folder. The only contract with MCD is the output pack and reading the card JSON.
- The tool's own tests use generated images, like MCD's.

### 4.5 Special cases, one by one

| Case                             | Handling                                                                                                                                                                                                                                                                                                                       |
| :------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero and alter-ego               | Two codes (`NNNNNa` and `NNNNNb`). The existing lookup already treats them as separate cards.                                                                                                                                                                                                                                  |
| Several identity cards per hero  | Each version has its own code pair. The recipe maps each by file; no engine change. M3 checks that each version is selectable and shows its own image.                                                                                                                                                                         |
| Triple-sided heroes              | The third face is a normal card code (`12001c`, `13001c`, `42001c`). The converter splits the fold strip into three panels. M3 checks which of the three the game can show; if the engine never displays a `c` face today, the art is still mapped (ready for later) and a GitHub issue is opened for the missing form change. |
| Full-bleed print sheets          | The converter trims bleed by the pixel count measured in M0 and splits sheets by grid. Output is the cut-line card, so the app's own rounded corners and border do not show a stray margin.                                                                                                                                     |
| Watermark                        | Untouched (rule 6).                                                                                                                                                                                                                                                                                                            |
| Orientation                      | The pack image must have the shape the app expects for the card (ADR-0011). M0/M3 confirm whether identity cards are portrait in the app, from the loaded data.                                                                                                                                                                |
| Heroes missing from the set      | Keep official art. Never an error.                                                                                                                                                                                                                                                                                             |
| Card Editor                      | Still shows official art by design (ADR-0093, decision 10). No change.                                                                                                                                                                                                                                                         |
| Worktrees and agents             | The finished pack lives in the central folder; `assets:pull` junctions it into every worktree. Sources are not synced.                                                                                                                                                                                                        |

## 5. Engine, schema and UI changes

Expected: **none** in `src/engine`, none in the art pack schema. The risk is in the UI, so M3 is a verification gate, and any gap found there is fixed in its path (No Tech Debt Mandate), not deferred. Things M3 checks that could expose a gap:

- Hero select, `HeroZone`, board zoom, the deck builder list and any identity thumbnail all call `localArtUrl`/`useCardArt` with the identity's own code.
- Flip between hero and alter-ego swaps the image without a blank frame (pack images are not preloaded like scenario tokens; if it flashes, add the identity codes to `preloadArtPackImages` at game start).
- On-card UI (badges, name plates, damage counters) does not cover the watermark in a way that matters.
- A missing or broken image falls back to official art (existing behaviour, retested for an identity card).

## 6. Tests in MCD (written first)

All use synthetic images generated at run time in a temp folder.

- `tests/data/art-pack-identities.test.ts`: with a synthetic pack covering `29001a`, `29002b`, `12001c` and `31001a`, `artPackArt(code)` returns the pack URL for each, and an uncovered hero returns `undefined`.
- UI: an identity `CardView` shows the pack URL, and falls back to the official URL when the image errors (extends the existing art pack tests).
- Existing guards keep running: `leak:check`, `pack:validate`, docs check. No allowlist entry is added.

## 7. Milestones

| #  | Step                                                                                                                                                                         | Where               | Done when                                                                 |
| :- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------ | :------------------------------------------------------------------------ |
| M0 | Download the Drive folder to `temp/art-sources/corbintm/`; produce the inventory (4.2); replace the assumptions in section 8. Steve answers the open decisions.             | Steve's PC (RC)     | Inventory posted in words; section 8 updated.                             |
| M1 | In the private repo: converter, recipe, tests. MCD: failing tests for the identity path (section 6).                                                                         | Private repo, MCD   | Private repo tests green; MCD tests written and failing for the right reason or passing. |
| M2 | Build the pack from the real files, drive coverage to every covered hero, review the contact sheet with Steve.                                                               | Steve's PC          | Zero unknown codes; Steve confirms the mapping by eye.                    |
| M3 | In-game check (list below). Fix what it finds in its path, in MCD.                                                                                                           | Steve's PC (RC)     | All items pass; findings fixed or issued.                                 |
| M4 | MCD docs and ADR amendment, changelog fragment, `assets:push` of the converter and pack, delete this plan file in the delivering commit, close #618.                        | Cloud, PC           | PR merged ("Merge" from Steve); #618 closed with `Fixes #618`.            |

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
- Identity cards are portrait in the app.
- The set covers Core through the Civil War heroes; later heroes in the repository stay official.

## 9. Documentation (MCD)

- `docs/creators/art-packs.md`: new section **Hero and alter-ego art**: how identity codes work (pairs, several versions, third faces, SP//dr), the shape and size an image should have, bleed already removed, the watermark and credit expectation, and a statement that MCD ships no converter: make the PNGs by hand or with your own tooling. Corbintm's set appears only as the worked example, like the Ultron tokens, with no images.
- ADR-0093: short amendment (not a new ADR) recording that identity cards are supported, that conversion tooling is deliberately outside MCD, and the permission position (rule 8).
- `docs/backlog/teamwork_status_and_next_target.md`: update the queue.
- `changes/unreleased/618-hero-art-packs.md` (type `Added`).
- This plan file is deleted in the commit that delivers the work.

## 10. Parked (not needed to prove the engine)

- Releasing the converter publicly. If done later it needs its own repository or release, a license decision on the tool, and a clear statement that it ships no fan art. Not planned now.
- An MCD command that checks an art pack's PNGs against the loaded cards. The loader already validates the manifest; add a checker only if pack authors ask.
- A Content-screen switch to turn a pack off, or a choice between several packs for one card (found means used stays, ADR-0093 decision 2).
- Browser or desktop import of the Drive zip (M11/Tauri are parked).
- Art for non-identity cards, localisation of art, replacing card backs.
- Automatic watermark handling of any kind (rule 6).

## 11. Debt removed

None found. Looked at: `art-pack.ts`, `art-pack.schema.json`, `card-art.ts`, `image-cache.ts`, `card-art-middleware.ts`, `private-assets.ts`, the creator guide and ADR-0093. The only candidate is the `preloadArtPackImages` call that today covers scenario tokens only; it is changed in M3 if the flip flashes, not before.

## 12. Open decisions for the owner

| # | Decision                                                                                                                                                                                  | Recommendation                                  |
| :- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------- |
| 1 | Where the converter sits inside `mcd-private-content`: a `tools/art-pack-build/` folder with its own dependency file and a `.gitignore` for its environment. Language is free; recommendation: Python with Pillow.                               | Yes; `assets:push` then carries it as is.       |
| 2 | Send Corbintm one message asking if local display is fine (section 3, rule 8).                                                                                                            | Yes, in parallel; not blocking.                 |
| 3 | If the Drive turns out PDF-only, the private converter rasterizes PDFs itself.                                                                                                            | Decide after M0.                                |
| 4 | Cache busting after a rebuild: ADR-0093 notes the browser keeps images for a long time. Document the clear-cache step, or version file names (`29001a_v2.png`).                          | Document the clear-cache step.                  |
| 5 | Keep "found means used": the pack replaces official art for every covered hero with no off switch.                                                                                        | Yes for now; park the switch until it hurts.    |
