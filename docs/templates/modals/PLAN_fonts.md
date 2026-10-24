# Plan: align and fix the remaining font issues

Status: **D1 to D6 approved. Phase 1 is done (slots and names). Phase 2 is done: the lab font test has a Numbers & codes list and the key M. Phase 3 is done: the font record is generated and tested. Phase 4 is done: the font guards. Phase 5 is done: every theme is validated (fonts, sizes, numbers and digits) and D7 is decided. Phase 6 is done: the lab is dev only. All six phases are complete.** Decision D8 stays open.
Scope: the **theme layer and the lab** (`src/ui/theme/`, `src/ui/components/templates/`, docs). Wiring the
fonts into the real game screens is the last section ("Next steps"), to discuss once this is settled.

Related: [Font record](./FONT_RECORD.md) (what can be set today), [Theme engine plan](./PLAN_theme_engine.md).

## 1. What "Serif role" and "Mono role" actually mean

These two came from the code, not from design. They are the CSS font utilities `font-serif` and `font-mono`
that some components name directly. A theme can replace what they show. Here is what they are used for in the game today:

| Role                          | In plain words                 | Where the game uses it (measured)                                                                                                                                     | My recommendation                                                                                                                                      |
| ----------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Serif role** (`font-serif`) | The newspaper typeface         | 16 uses in 4 files, **all Daily Bugle**: the action sheet, the end-turn press flash, the top bar's Bugle button, the floating EXTRA! button                           | **Remove it as a separate slot.** Every use is a newspaper surface, so it is already the **Newspaper pair**. Two slots for one thing is the confusion. |
| **Mono role** (`font-mono`)   | The font for numbers and codes | 61 uses in 26 files: counters (`HP 7 / 10`), badges (`1 / ROUND`), key caps (`Spacebar`), card codes, dev panels. 12 of the 26 files are the card editor (a dev tool) | **Keep it, rename it "Numbers & codes".** Same behaviour, a name that says what it does.                                                               |

So the minimum set per theme becomes:

| Slot (what you see in the picker) | Plain meaning                                      | Applies to                      | Required?                                  |
| --------------------------------- | -------------------------------------------------- | ------------------------------- | ------------------------------------------ |
| **Headlines**                     | Titles and larger text                             | Every themed surface            | Yes                                        |
| **Body**                          | Smaller text: descriptions, rows, labels, captions | Every themed surface            | Yes (Pop-Art gets an explicit Inter)       |
| **Newspaper headlines**           | Daily Bugle titles, flashes, section names         | Newspaper surfaces only         | Optional: unset follows Headlines          |
| **Newspaper body**                | Daily Bugle stories and dispatches                 | Newspaper surfaces only         | Optional: unset follows Body               |
| **Numbers & codes**               | Counters, badges, key caps, card codes             | Anything that names `font-mono` | Optional: unset keeps the system monospace |

(Your list had Serif role as its own line. If you prefer to keep it, I would call it "Print type" and make it the
default of the two Newspaper slots. Decision D1.)

## 2. What is wrong today (found in the code and the lab)

| #   | Issue                                                                                                                                                                                                               | Evidence                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| F1  | **"Body" has almost no consumers in the game.** `font-body` is used 0 times. Body text is `font-comic` (254 uses, 42 files) or `font-sans` (15 uses). The root is `font-sans`, which is the system sans, not Inter. | `grep` of `src/ui`                                                             |
| F2  | The Body slot is therefore only visible where the lab or a theme token names it, so Pop-Art "keeps Inter" is not true in practice.                                                                                  | F1                                                                             |
| F3  | Headline versus body is decided by the **class**, not the **size**. Small text using `font-comic` gets the Headlines font. The lab test splits at 17px, the game does not.                                          | Lab test vs game                                                               |
| F4  | The Newspaper pair is read only by the lab's `NewspaperSheet`. The real Bugle screens still use `font-serif`, `font-comic`, `font-mono` directly.                                                                   | `DailyBugleActionNewspaper`, `EndTurnConfirmationModal`, `TopBar`, `GameBoard` |
| F5  | The lab picker cannot test **Numbers & codes** (and had no Serif list). Two slots can be set in code but not previewed.                                                                                             | `FONT_RECORD.md`                                                               |
| F6  | `FONT_RECORD.md` is written by hand. It will drift from `modal-styles.ts`.                                                                                                                                          | Process                                                                        |
| F7  | `fonts.serif` and `fonts.mono` names do not say what they do (section 1).                                                                                                                                           | Naming                                                                         |
| F8  | Display and script fonts (Kalam, Special Elite, Boogaloo) at 9 to 10px labels may not read. Not measured yet.                                                                                                       | Open question D7                                                               |
| F9  | The lab ships in the production build with about 1.2 MB of test fonts.                                                                                                                                              | `/templates` is lazy but bundled                                               |

## 3. Target model

```ts
interface ThemeFonts {
  headline: string; // required
  body: string; // required (Pop-Art: Inter, explicit)
  newspaper?: { headline?: string; body?: string }; // optional override, Newspaper surfaces only
  numbers?: string; // "Numbers & codes", optional (was `mono`)
} // `serif` is removed (D1)
```

Order of precedence stays as in the font record: Newspaper slot, else the theme's Headlines or Body. CSS utilities do not
change names (`font-comic`, `font-body`, `font-mono`, `font-news-headline`, `font-news-body`); `font-mono` reads a new
`--font-numbers` variable. The lab picker gets the same five slots.

## 4. Decisions needed from you

| #   | Decision                                                                                                    | My recommendation                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| D1  | Serif role: remove it (fold into Newspaper) or keep it as "Print type"?                                     | **Remove.** All 4 users are Bugle surfaces.                                                                              |
| D2  | Mono role: rename to "Numbers & codes" and keep?                                                            | **Yes.**                                                                                                                 |
| D3  | Require an explicit Body font for every theme (Pop-Art gets Inter written down)?                            | **Yes**, so Body is never implicit.                                                                                      |
| D4  | Rule for Headlines versus Body in the game: size (17px and up is a headline, like the lab) or by hand?      | **Size**, enforced by a one-time codemod and a guard test (next steps, N2).                                              |
| D5  | Should the base text of every themed surface be the Body font (headline font is opt-in)?                    | **Yes.** Unlabelled text becomes Body, which is the fix for "Bangers in small body text".                                |
| D6  | Keep `/templates` and its 34 test fonts in the production build, or make the lab dev-only?                  | **Dev-only**, or at least a separate chunk: measure first.                                                               |
| D7  | Minimum text size for Kalam, Special Elite, Boogaloo (for example no body text under 12px in those themes)? | **Decided in phase 5:** no single minimum. Each theme has its own small-text size change (`fonts.sizes`): Body +1 to +3. |
| D8  | Player-facing font choice in Options (now: themes only)?                                                    | **Later**, not in this plan.                                                                                             |

## 5. Phases (theme layer and lab)

Each phase is developed, tested and reviewed with you before the next. Nothing is committed until you ask.

### Phase 1: slots and names (done)

- `ThemeFonts`: add required `body`, rename `mono` to `numbers`, remove `serif` (D1-D3). Update the 7 themes (`modal-styles.ts`), `themeFontVars`, `tailwind.config.js` (`mono` reads `--font-numbers`), `index.css` default.
- Newspaper tokens already use `font-news-*`; nothing to change there.
- **Simplification check:** one slot removed, one renamed, no new code path. `--font-serif` and `fonts.serif` disappear.
- **Debt removed:** the `serif` slot and its tests; the implicit Pop-Art body.
- **Tests:** `tests/ui/theme-fonts.test.tsx` (slots, vars, required body), update `FONT_RECORD` checks.

### Phase 2: lab picker parity

- Add a **Numbers & codes** list to the Font test (CSS rule on `.font-mono`, outside the lab bar), shortcut **M**, and a plain tooltip for each slot. Rename the two newspaper lists "Newspaper headlines" and "Newspaper body" (already) and drop any serif wording.
- **Simplification check:** reuses the same slot picker component and the same state shape (one more key).
- **Tests:** `tests/ui/font-test.test.tsx` (new slot, shortcut, reset, persistence).

### Phase 3: a record that cannot drift (done)

- A small audit script (new in this phase, with its own npm script next to the other audit tools) writes the "What each theme uses" table of `FONT_RECORD.md` from the theme tokens, between markers. A freshness test fails when it is stale, as the declaration reports do.
- The "what can be set" table stays hand-written; a test checks that every `ThemeFonts` key appears in it.
- **Debt removed:** hand-edited tables.

### Phase 4: guards (done)

- A test that theme token strings use only the role utilities (`font-comic`, `font-body`, `font-mono`, `font-news-*`), never a family or `font-serif`.
- A test that the lab's `fonts/` list and `lab-fonts.css` stay in step (already partly there).

### Phase 5: readability review and final font choice (done)

This is where the fonts are **validated and finalized**. Changing a theme's font is **in scope here**: the fonts
in the record are the current choices, not final ones.

**Method**

1. Go theme by theme (7), on the same screens: a Decision modal, an action menu, Payment, the Distribute and Sequence modals,
   the Newspaper action sheet, and the Setup page. Look at the smallest text (9 to 13px), the digits, the all-caps labels and the
   Newspaper.
2. Use the lab Font test for any swap (Headlines, Body, Newspaper, Numbers & codes). Press F, H, B, N, M to compare.
3. For each slot of each theme, record a status and write it in the matrix below. A font is final only when its status is **Validated**.

**Status values**

| Status            | Meaning                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| **Chosen by you** | You picked the font. Readability not checked yet.                          |
| **Set by me**     | I picked it to keep a look or fill a gap. You have not decided it.         |
| **Default**       | Nothing was set; the game or CSS default applies. You have not decided it. |
| **Validated**     | Reviewed in this phase and accepted. Final.                                |
| **Open**          | Rejected or undecided; a replacement is being tested.                      |

**Matrix: final status.** Every cell was reviewed theme by theme in the lab. The sizes are written in the theme tokens (`fonts.sizes` in `modal-styles.ts`), the fonts in `fonts`.

| Theme                | Headlines                     | Body                          | Newspaper headlines                       | Newspaper body                         | Numbers & codes          | Small text (9 to 13px) | Digits                           |
| -------------------- | ----------------------------- | ----------------------------- | ----------------------------------------- | -------------------------------------- | ------------------------ | ---------------------- | -------------------------------- |
| Pop-Art Action-Coded | Lilita One: **Validated**     | Inter: **Validated**          | System serif: **Validated**               | System serif: **Validated**            | Nunito +1: **Validated** | Body +1: **Validated** | Lilita One digits: **Validated** |
| Storyboard Panels    | Kalam: **Validated**          | Kalam: **Validated**          | Kalam, follows: **Validated**             | Kalam, follows: **Validated**          | Nunito +1: **Validated** | Body +2: **Validated** | **Validated**                    |
| Golden Age Newsprint | Merriweather: **Validated**   | Merriweather: **Validated**   | Merriweather, follows: **Validated**      | Merriweather, follows: **Validated**   | Nunito +1: **Validated** | Body +1: **Validated** | **Validated**                    |
| Night Edition        | JetBrains Mono: **Validated** | JetBrains Mono: **Validated** | JetBrains Mono, follows: **Validated**    | JetBrains Mono, follows: **Validated** | Nunito +1: **Validated** | Body +1: **Validated** | **Validated**                    |
| Splash Page          | Boogaloo: **Validated**       | Boogaloo: **Validated**       | Boogaloo, follows: **Validated**          | Boogaloo, follows, +4: **Validated**   | Nunito +1: **Validated** | Body +3: **Validated** | **Validated**                    |
| S.H.I.E.L.D. Dossier | Special Elite: **Validated**  | Special Elite: **Validated**  | Special Elite, follows, -1: **Validated** | Special Elite, follows: **Validated**  | Nunito +1: **Validated** | Body +2: **Validated** | **Validated**                    |
| Hero HUD             | Lexend: **Validated**         | Lexend: **Validated**         | Lexend, follows: **Validated**            | Lexend, follows: **Validated**         | Nunito +1: **Validated** | Body +1: **Validated** | **Validated**                    |

**Also surfaced in the review, and how each was settled**

- The **Body** font of each theme: Validated per theme; the six single-font themes keep one font for both slots, Pop-Art keeps Inter.
- A **different Newspaper pair** per theme: only Pop-Art has one (system serif); every other theme's newspaper follows its theme font. Validated.
- **Numbers & codes**: Nunito +1 in every theme (you chose it; it replaces the system monospace and the fonts Night, Dossier and Hero HUD had).
- The **combat log fonts** (Komika and the presets): still open, step N5.
- The **minimum text size** (D7): decided, see below.
- **Pop-Art body** stays Inter. Bangers keeps a place on the intro/main screen banner only (N8); everything else follows the selected theme.
- **Pop-Art digits**: Lilita One's own digits are Validated; no digit face is needed.

**Measured before the theme-by-theme review** (computed styles on 8 lab screens in all 7 themes: Decision, an action menu, Payment, Distribute, Sequence, Newspaper, Setup, Elements)

1. **The Body font is not visible on any modal.** On a modal, 97% of the text draws in the Headlines font (Pop-Art Decision: Lilita One on 35 of 36 text pieces, Inter on none). So for the six themes with one font for both slots, Body and Headlines already look the same and the review only judges that one font. For Pop-Art, Inter shows only on Setup and Elements (21 to 47 pieces); its pairing with Lilita One cannot be judged on a modal until step N2 moves small text to Body.
2. **Small text is the main readability risk.** Every screen has text at 9 to 10px, mostly all-caps labels. Distribute has 9px labels (`DAMAGE`, `TOUGH`). Payment has 65 of 70 text pieces at 13px or smaller, Sequence 49 of 52. The sizes are the same in every theme, so the risk depends only on the font: it is highest for Kalam, Special Elite and Boogaloo (D7).
3. **Digits**: 10px counters (`3 DMG`, `10 / 10 HP`, `HAND SIZE: 5`) are all-caps in the Headlines font, so the digit shapes are the Headlines font's own in every theme except the default Bangers stack.
4. **Newspaper**: only Pop-Art has its own pair (100 of 109 pieces in the system serif). The other six draw the Newspaper in their theme font, including 74 pieces at 13px or smaller.

**D7 decision: a size change per theme, not one minimum**

You judged the small text in the lab with the `-` and `+` buttons and saved a size change for each theme. These became the themes' defaults:

| Theme                                                  | Body | Numbers & codes | Newspaper    |
| ------------------------------------------------------ | ---- | --------------- | ------------ |
| Pop-Art, Golden Age Newsprint, Night Edition, Hero HUD | +1   | +1              | follows      |
| Storyboard Panels                                      | +2   | +1              | follows      |
| S.H.I.E.L.D. Dossier                                   | +2   | +1              | headlines -1 |
| Splash Page                                            | +3   | +1              | body +4      |

How it works: a size change in px is added to body-sized text (`text-xs`, `text-sm`, `text-nano`, `text-micro`, `text-mini`), to headline-sized text (`text-base` and up) and to numbers and codes. Cards keep their own sizes. A test fails when a themed file uses a fixed pixel size under 17px.

**Outcome (reached):** every cell Validated, the final fonts and sizes written into the theme tokens, the font record regenerated, and D7 decided.

### Phase 6: lab in production (D6): done, the lab is dev only

Two production builds (`vite build`, same code, only the lab route differs):

|                        | With the lab (today) | Without the lab (dev only) | Difference           |
| ---------------------- | -------------------- | -------------------------- | -------------------- |
| All files in `assets/` | 3 344 kB (96 files)  | 2 294 kB (54 files)        | **-1 050 kB (-31%)** |
| Font files (`.woff2`)  | 66 files, 1 617 kB   | 30 files, 661 kB           | -36 files, -956 kB   |
| Lab code chunk         | 83 kB JS + 9 kB CSS  | none                       | -92 kB               |

The lab needs 36 font files of its own (956 kB); 9 more it shares with the game (187 kB). The game's own fonts are 30 files (661 kB: every theme's font, Nunito and the existing ones).

What a player downloads does not change either way: the lab is a lazy chunk that is only fetched on `/templates`, nothing preloads it or any font, and a font file is only fetched when text uses it. The difference is what is stored and deployed (about 1.0 MB), and whether the design lab is reachable on the deployed site.

**Options**

1. **Dev only (recommended):** the lab route is built only for the dev server (`import.meta.env.DEV` around the lazy import). Saves 1 050 kB deployed, the lab is not public, nothing else changes. The lab stays at `localhost:3000/templates/`.
2. **Keep it, as a separate chunk (today):** no change; costs 1 050 kB deployed; the lab is reachable on the deployed site.

**Chosen: option 1, dev only.** In `App.tsx` the lab screen is loaded only when `import.meta.env.DEV` is true, and a `/templates` address on a production build opens the game's first screen. `tests/tools/lab-dev-only-build.test.ts` runs the production build and fails if a lab chunk or a lab-only font ships, or if a theme font goes missing. The test was checked to fail when the lab is put back.

## 6. Next steps: integration into the game (to discuss after phases 1 to 5)

**The ordered integration plan (N1 to N9, with sizes, risks and decisions) is [PLAN_game_integration.md](./PLAN_game_integration.md).** The table below is the original list.

These change how the real game looks, so each needs your go-ahead. They are listed with their dependencies and size.

| #   | Step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Size and risk                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| N1  | **Make Body real.** `font-sans` and the page base follow `--font-body`; decide the default (Inter or system). Themed surfaces use Body as their base text (D5).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Small code, visible change everywhere text has no explicit font.                             |
| N2  | **Split small `font-comic` text into Body** by the size rule (D4): a codemod over about 254 uses in 42 files, then a guard test that forbids small text with `font-comic`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Large mechanical change, needs a visual pass per screen.                                     |
| N3  | **Newspaper surfaces read the Newspaper pair**: `DailyBugleActionNewspaper`, `EndTurnConfirmationModal`, the top bar Bugle button, the floating EXTRA! button, `CombatLogDrawer`. A shared wrapper sets the newspaper variables, as `NewspaperSheet` does in the lab. Their `font-serif` and direct `font-mono` go away.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Medium. Ties in with the three-column rule and the audit's Newspaper kit plan.               |
| N4  | **Board, zones, hand tray, setup screens join the themes** (separate audit plan); fonts follow the same slots. Only the intro/main screen banner is excluded (N8); the rest of the setup screen is themed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Large, already planned in the unthemed-UI audit.                                             |
| N5  | **Combat log fonts** (`font-dialogue`, Komika and the presets): themed or left alone?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Small, needs a decision.                                                                     |
| N6  | **Card editor** keeps the system fonts and is excluded from themes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | None, record it.                                                                             |
| N7  | **Player font choice** (D8).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Later.                                                                                       |
| N8  | **Only the intro/main screen banner keeps its look; everything else follows the selected theme.** The banner (your screenshot) is the yellow "MISSION CONTROL • SCENARIO SELECTION" tab tilted on a black shadow, the large red "MARVEL CHAMPIONS" title and the blue spaced-out subtitle, all in Bangers. It appears on that one screen only (`ScenarioSelector.tsx` lines 132 to 140). Today it uses the `font-comic` role, which follows the theme once the setup screen is themed (N4), so the banner is pinned to Bangers (`font-bangers`) and its colours, and a test fails if it ever follows a theme. The rest of that screen (scenario spread, deck choices, launch bar) and every other screen follow the selected theme (N4). Bangers keeps a place for this banner; the other explicit uses of `font-bangers` (26 in 13 files) are reviewed under N4. | Small. Must land before or with N4.                                                          |
| N9  | **The theme selector is on the first screen, before a game starts.** It exists there already but is collapsed inside a "Theme:" panel at the bottom of the setup. It becomes visible without opening anything: the 7 themes plus "Random each game", with the current choice marked, saved with the game settings (`themeMode`, `themeId`) and used when the game starts. The intro banner stays as in N8 whatever theme is selected.                                                                                                                                                                                                                                                                                                                                                                                                                             | Small to medium: layout on the intro screen, plus a test that it is reachable before a game. |

## 7. Out of scope

Font size, weight and spacing; player-chosen fonts. (Changing which fonts a theme uses is in scope, in the phase 5 review.)
