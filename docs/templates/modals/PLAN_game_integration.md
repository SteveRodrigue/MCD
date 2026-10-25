# Plan: bring the validated fonts and sizes into the game (N1 to N9)

Status: **approved. N1 to N6, N8 and N9 are done, and N4 (the board, setup, table, combat log drawer and Daily Bugle follow the theme) is done in eight phases ([the board plan](./PLAN_board_theming.md)). Only N7 (player font choice, issue #374) is open, by choice.** Each step was a separate, reviewable change.

Related: [Font plan](./PLAN_fonts.md) (phases 1 to 6 are done), [Font record](./FONT_RECORD.md), [Theme engine plan](./PLAN_theme_engine.md), [Unthemed UI audit](./AUDIT_unthemed_ui.md).

**End state (confirmed by you):** the whole player-facing UI follows the selected theme: fonts, sizes, colours, panels, board, setup, newspapers. The only thing kept is the "MARVEL CHAMPIONS" Bangers banner on the first screen (N8). The card editor (`/editor`) stays a developer tool outside the themes (N6) unless you say otherwise. This plan gets the fonts there (N1 to N3, N5, N8, N9); N4 is the step that makes everything else follow, so it is required, not optional.

## 1. What this plan covers, and what it does not

| In this plan                                                                                                   | Not in this plan                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Making the game screens read the theme's fonts and text sizes (N1, N2, N3, N5)                                 | Restyling the board, zones and hand tray beyond fonts (N4, which has its own plan: [PLAN_board_theming.md](./PLAN_board_theming.md)) |
| Your two additions: only the intro banner keeps its look (N8), and the theme selector on the first screen (N9) | Gameplay rules: this is presentation only, the engine (`src/engine/`) is not touched, so the Rules Reference does not apply          |
| Keeping the card editor out of the themes (N6)                                                                 | A font choice for players (N7, later)                                                                                                |

UI impact: every visible change is listed per step. Card Editor impact: none, and that is enforced by a guard (N6).

## 2. Starting point (measured before N1)

- The theme is already app-wide: `ThemeProvider` (`src/ui/theme/ThemeProvider.tsx`) gives every component the active style, but only modals, previews and the lab set the font variables (`themeFontVars`). The game root does not.
- The page base is `font-sans` (the system sans) on the `App.tsx` root. `font-body` has 13 uses. The `:root` default of Body is Inter.
- `font-comic` (Headlines) has **266 uses in 48 files**. On the same line as a small size token (`text-xs`, `text-sm`, `text-nano`, `text-micro`, `text-mini`): **144**. With a headline size: 35. With no size on the line (the size is on a parent): **87**.
- `font-serif` (Daily Bugle): 16 uses in 4 files (`DailyBugleActionNewspaper` 10, `EndTurnConfirmationModal` 3, `GameBoard` 2, `TopBar` 1).
- `font-bangers`: 26 uses in 13 files (the editor has 17 of them).
- The combat log had its own font selector (Bangers, Komika, Comic Relief, Comic Neue, Clean) and the Komika font files; removed in N5 (see below).
- The first-screen theme picker existed (`ScenarioSelector.tsx`, a collapsed "Theme:" panel).
- The card editor (`/editor`) uses `font-sans`, `font-bangers` and `font-mono` (for code and JSON).

## 3. Order, by dependency

```
N6 guard ──> N1 ──┬──> N8 ──┐
                  ├──> N9   ├──> N2 ──> N4 ──> N7 (later)
                  ├──> N5   │
                  └──> N3 ──┘
```

| Order | Step                                                                       | Size (agent work, then your review)  | Depends on | Risk                                                     |
| ----- | -------------------------------------------------------------------------- | ------------------------------------ | ---------- | -------------------------------------------------------- |
| 1     | **N6** Keep the editor out of the themes (done)                            | S: about 15 min                      | none       | low                                                      |
| 2     | **N1** Make Body real, set the theme variables at the game root (done)     | S to M: about 45 min                 | N6         | medium: a visible change everywhere text has no font     |
| 3     | **N8** Pin the intro banner to Bangers (done)                              | S: about 20 min                      | N1         | low                                                      |
| 4     | **N9** Theme selector visible on the first screen (done)                   | M: about 1 h                         | N1         | low to medium                                            |
| 5     | **N5** Combat log joins the theme; font selector and Komika removed (done) | S to M: about 1 h                    | N1         | low                                                      |
| 6     | **N3** Daily Bugle surfaces read the Newspaper pair (font slice) (done)    | M: about 1.5 h                       | N1         | medium                                                   |
| 7     | **N2** Small `font-comic` text becomes Body, with a guard (done)           | L: about 3 to 4 h, in 6 to 8 batches | N1, N8, N3 | medium: large and mechanical, but no visible change (D9) |
| 8     | **N4** Board, zones, hand tray and setup join the themes (done)            | XL: days, **its own plan**           | N1, N2, N3 | high                                                     |
| 9     | **N7** Player font choice (D8)                                             | later                                | N4         | n/a                                                      |

## 4. The steps

### N6. Keep the editor out of the themes (first, so N1 cannot leak into it)

- **Problem:** N1 sets font variables at the game root. If it wrapped the editor, `font-mono` (JSON, code) there would turn into Nunito.
- **Done:** `isGameStage` (`src/ui/theme/game-stage.ts`) says which screens follow the theme: setup, mulligan, game. The root of `App.tsx` passes it to `GameThemeRoot`; the editor (`/editor`) and the lab (`/templates`, dev only) are inactive and get no variables.
- **Guards (`tests/ui/font-guards.test.ts`):** no editor file names a theme-only role (`font-body`, `font-news-*`, `text-nano`, `text-micro`, `text-mini`), and `App.tsx` passes the stage to the root. The editor keeps `font-comic` and `font-mono`: outside a themed screen they resolve to the `:root` defaults (Bangers, system monospace), which is what it uses today.
- **Checked in the browser:** `/editor` has 0 elements with theme variables, its root is the system sans, its `font-mono` is the system monospace.
- **Debt removed:** an unwritten rule ("the editor is not themed") becomes a test.

### N1. Make Body real, and set the theme variables at the game root

- **Change:**
  1. **Done:** `GameThemeRoot` (`src/ui/theme/GameThemeRoot.tsx`) sets `themeFontVars(style)` on the root element of the game stages, as `ModalScaffold` does for a modal. Everything inside, not only modals, follows Headlines, Body, Numbers & codes and the size changes.
  2. **Done:** the root's base font changes from `font-sans` (system sans) to `font-body`, so unlabelled text follows the theme's Body (decision D5, already approved). Checked in the browser: Pop-Art first screen, Inter, with the Pop-Art variables set.
  3. `ModalScaffold`, `ThemedTable` and `ThemePreview` keep setting the variables themselves: they are different scopes (a modal is in a portal outside the root, the table and the lab are outside the game root, a preview shows another theme's fonts). They all call the same `themeFontVars`, so there is one source of the values.
- **Files:** `src/ui/App.tsx`, `src/ui/theme/ThemeProvider.tsx` (or a new wrapper next to it), `src/ui/theme/kit/surfaces.tsx`, `tailwind.config.js` (no change expected), 1 or 2 tests.
- **Visible change:** text with no explicit font (setup labels, board text) goes from system sans to the theme's Body. In every theme that is the theme's one font (Pop-Art: Lilita One, since D9). This is the intended D5 result.
- **Risks:** the Random theme roll happens when a game starts, so before a game the first-screen theme is the saved one; the wrapper must read the active style, never the roll alone. The `cards` rule (`[data-card-view]` resets the size change) already protects card faces.
- **Simplification & refactor check:** no second copy of the values: every site calls `themeFontVars`. (An earlier draft of this plan said the other sites would stop setting variables; that was wrong, see item 3.)
- **Tests (`tests/ui/game-theme-root.test.tsx`):** the root sets every variable for each of the 7 themes and makes Body the base; inactive it adds nothing; `isGameStage` is true only for setup, mulligan and game.

### N8. Only the intro banner keeps its look

- **Change:** in `ScenarioSelector.tsx` (lines 132 to 140), the three banner elements use `font-bangers` instead of `font-comic`, so they never follow a theme. Their colours are Tailwind constants (`comic-yellow`, `comic-red`, `comic-blue`) and do not change with a theme. The rest of the screen follows the theme (N4).
- **Done.** The banner (tab, title, subtitle) uses `font-bangers`. **Visible change:** none today (Bangers is the default); it only protects the look once the screen is themed.
- **Files:** `src/ui/components/setup/ScenarioSelector.tsx`, one test.
- **Tests (`tests/ui/intro-banner.test.tsx`):** under each of the 7 themes the three banner elements carry `font-bangers` and no theme role, and the classes are identical in all themes. Checked to fail when the title goes back to `font-comic`.
- **Risk:** low. The banner sizes are headline-sized (`text-xl` and up), so a theme's Body size change cannot move them.

### N9. The theme selector on the first screen (done, waiting for your review)

- **Done:** the "Theme:" panel in `ScenarioSelector.tsx` is a section that is always open (it was a collapsed `<details>`). The 7 themes and "Random each game" are visible without opening anything, with the current choice marked, followed by the Card accents switch. The choice is saved with the game settings (`themeMode`, `themeId`, as before) and used when the game starts (`rollGameTheme`, as before). It sits in the right column of the first screen, below the hero seats and above the launch bar.
- **Visible change:** the panel is open and about 450px taller. The banner is unchanged (N8). The picker keeps its 3-column tiles: a 4-column layout was tried and rejected because theme names overflowed in that column.
- **Live effect (D10, better than planned):** because the game root (N1) reads the active theme, choosing a theme on the first screen changes the first screen's fonts at once (checked: Night gives JetBrains Mono, Nunito numbers). The panels, colours and table stay as they are until N4.
- **Files:** `src/ui/components/setup/ScenarioSelector.tsx`, `tests/ui/theme-picker.test.tsx`.
- **Tests:** the picker and Random are not inside a closed panel; all 7 themes and Random can be chosen; a theme chosen on the first screen is saved and kept when the mission starts.

### N5. Combat log fonts (done, waiting for your review)

- **Decision (yours, replacing my D12 recommendation):** the combat log is part of the theme. The user font selector was a workaround for readability issues that the validated fonts and sizes now solve, so it is removed.
- **Done:** the "Font:" cycle button, its `localStorage` state and `combat-log-presets.ts` are removed from the drawer; the speech balloon no longer takes a font class. The dialogue and narration text use `font-body` (the theme's Body), the banners and onomatopoeia keep `font-comic` (Headlines), and the fixed 10 and 11px sizes became the size tokens, so the theme's text size change applies. The Komika font (4 files in `public/fonts/`, its `@font-face`, `.font-komika`, `.font-comic-relief`, `.font-comic-neue`, `.font-clean` and the Tailwind `dialogue` family) is deleted: nothing uses it any more. `@fontsource/comic-relief` stays: it is the fallback of three theme font stacks.
- **Not done here:** the drawer's colours and panels (slate masthead, filters) still look the same in every theme; they move with N4 (the audit puts the log in the Newspaper work).
- **Tests:** `tests/ui/combat-log-drawer.test.tsx` (no font selector, Body dialogue, theme variables on the drawer); a guard fails when any combat log font class, `Komika`, the old storage key or the presets file comes back, or when `public/fonts` or a Tailwind `dialogue` family reappears.
- **Stale data:** a browser that used the old selector keeps an unused `mcd_combat_log_font` value in its local storage; it is never read.

### N1 follow-up: portalled layers (found while doing N5)

- **Problem:** every modal, drawer and banner renders through `ModalLayer`, a portal into `document.body`, so it sits outside the game root and did not inherit the theme variables. Themed modals worked because `ModalScaffold` set the variables itself. The Daily Bugle sheet, the end-turn flash and the combat log did not: their `font-comic`, `font-mono` and text size tokens fell back to the defaults. My N3 note ("font-comic accents stay on the theme's Headlines") was therefore not true yet.
- **Fix (done):** `ModalLayer` sets `themeFontVars` and the `font-body` base itself (`themed={false}` for the lab's own chrome, which never follows a theme). `ModalScaffold` no longer sets them (one source). `tests/ui/modal-layer-theme.test.tsx` covers it.

### N3. Daily Bugle surfaces read the Newspaper pair (the font slice only; done, waiting for your review)

- **Done:** `useNewspaperProps` (`src/ui/theme/useNewspaperProps.ts`) gives a newspaper root the `data-newspaper` mark and the theme's newspaper variables; the lab's `NewspaperSheet` uses it too (one source). It is spread on the Daily Bugle action sheet, the end-turn flash, the top bar's Bugle button and the floating EXTRA! button. Their 16 `font-serif` became `font-news-headline` (the masthead, titles and button labels) or `font-news-body` (the base text and the stories). `font-comic` accents (section labels, story titles) stay on the theme's Headlines, `font-mono` counters follow Numbers & codes. The fixed 9, 10 and 11px sizes became `text-nano`, `text-micro` and `text-mini`, so the newspaper text size changes apply (Splash +4, Dossier headlines -1).
- **Visible change:** Pop-Art keeps its serif broadsheet masthead and stories. In the other six themes the paper's masthead and stories are drawn in the theme's font. Splash newspaper text is 1px bigger than its Body (+4 against +3) inside the paper.
- **Not included:** the full Newspaper kit (eras per theme, layout) from the audit (decision D6): a separate, larger plan. The three-column rule is untouched.
- **Tests:** `tests/ui/newspaper-fonts.test.tsx` (the sheet carries the mark and the variables of each of the 7 themes; the end-turn flash; Splash +4, Dossier -1); a guard fails when `font-serif` appears anywhere in `src/ui`, and fixed pixel sizes are forbidden in these files; the Daily Bugle and EXTRA! button tests are updated and pass.
- **Not checked in the real game:** the sheet and the EXTRA! button were not opened in the browser (reaching them needs a game in a multi-hero turn). The first screen and the mulligan screen were checked under Splash.

### N2. Small `font-comic` text becomes Body (the large, mechanical step)

- **Why:** today 97% of modal text and most board text uses the Headlines font, so the Body font is invisible. The size rule (decision D4) says: text under 17px is Body, 17px and up is Headlines.
- **Change:** the 144 small uses (and the 87 where the size is on a parent, found by reading each file) move from `font-comic` to `font-body` or are removed where the base text already is Body (after N1, plain text already follows `font-body`). A guard test fails when one className has both `font-comic` and a small size token.
- **Rule (script `n2_batch.py`, then the guard):** on one element, a small size token (`text-xs`, `text-sm`, `text-nano`, `text-micro`, `text-mini`) with no headline size (`text-base` and up, also with a responsive prefix) means the element loses `font-comic` and inherits the Body (the modal layer and the game root set it). Headline-size text and text with no size token (the inherited 17.6px base) keep `font-comic`. In the two newspaper surfaces every `font-comic` becomes `font-news-headline`, as in the lab's Newspaper kit.
- **Batches (each shown to you before the next):** 1) the themed modals and the two newspapers (**done, committed**), 2) the theme layer, the kits and the burst (**done, committed**), 3) setup (ScenarioSelector, Mulligan) (**done, committed**), 4) hero and villain zones (**done, not committed**), 5) hand tray, top bar, stepper and the combat log drawer (**done, committed**), 6) cards and context menu (**done**), 7) the rest, with the whole-UI guard (**done**). The guard (`tests/ui/font-guards.test.ts`, "small text is Body") lists the files of the finished batches; the last batch widens it to the whole UI except the editor.
- **Batch 1 result:** 45 uses moved to Body in 14 modal files (41 by the script, 4 template strings by hand), 4 kept on headline-size or sizeless text (`DecisionPromptModal` option title, `OptionsMenu` section title, `GameOverScreen` button, `RemovedFromGameBox` empty state), 21 in the two newspapers moved to the Newspaper headline role (66 `font-comic` removed in all). **Checked with a before and after snapshot of the lab: 133 screens (7 themes by 19 modals), 4,040 text pieces, 0 differences in font or size.**
- **Role audit (added after batch 1, because identical fonts cannot show a wrong role):** I temporarily gave Pop-Art a different Body font (Kalam) and listed, on all 23 lab screens, every text piece under 17px still drawn in Lilita One and every piece at 17px or more drawn in Kalam. It found what a before and after snapshot cannot: modal titles, counters, sign buttons and burst words had been Headlines only because the modal frame said `font-comic`, and the Decision option badges inherited Headlines from their parent. The temporary font was removed.
- **Rules that came out of it:**
  1. A modal frame sets the Body (`font-body`), never `font-comic`; the scaffold title says `font-comic` itself.
  2. Text with an explicit headline size (unprefixed `text-base` and up) names its role: `font-comic`, or `font-body` for prose. Text with no size token and no font class is Body (decision D5), so a sizeless button label, card name or paragraph is Body.
  3. Removing `font-comic` from a small element only gives Body when no ancestor sets Headlines. A Headlines parent with small badges inside gets the Headlines on the title text only (the Decision option row).
- **Batch 2 result (the theme layer, the kits, the burst):** the 4 modal frames now say `font-body`; the scaffold title, the burst words, the damage and heal counter and the speech bubble token say `font-comic`; 2 form fields and 1 kit sample moved to Body; 17 headline-size texts in the Payment, Combat boost, Distribute and Simultaneous modals now name `font-comic`. Role audit after the fixes: only text that is Body by the rules above remains in Body at 17px or more (sizeless buttons, names and paragraphs), and one small badge inside `CardView` is still Headlines (batch 6). **Before and after snapshot of the lab: 161 screens (7 themes by 23 pages, kits included), 5,601 text pieces, 0 differences in font or size.**
- **Batch 3 result (the setup screens):** 22 small-text uses moved to Body in `ScenarioSelector` and `MulliganScreen` (18 by the script, 4 template strings by hand), 23 kept on headline-size text (the screen headings, the scenario, deck and difficulty titles), 1 hero-name span names `font-comic` explicitly. The 23 fixed `text-[10px]` and `text-[11px]` became `text-micro` and `text-mini`, so the setup's tiny text follows the theme's text size change. The Bangers banner (N8) is untouched; the Mulligan screen's own heading is a normal themed heading. **Visible change, as intended:** the tiny labels on the first screen are 1 to 3px bigger depending on the theme (for example Pop-Art 10px to 11px). **Checked in the running game with the real theme switch: 7 themes, 1,547 text pieces on the first screen, 0 font differences, 105 size differences (all tiny text); the Mulligan screen has one font family per theme before and after.** The role audit (temporary Kalam Body under Pop-Art) on the first screen and the Mulligan screen flags only the difficulty titles (`text-sm sm:text-base`, headline from the `sm` width, kept on purpose) and the KEEP badge inside the card view (batch 6).
- **Batch 4 result (the hero and villain zones):** 46 small-text uses of `font-comic` moved to Body in `HeroZone`, `VillainZone` and `ThreatZoneSubzone` (30 by the script, 16 template strings by a run-based helper): the zones had no headline-size text at all. The 53 fixed sizes became tokens: 8px and 9px to `text-nano` (9px, so the 8px labels grow by 1px), 10px to `text-micro`, 11px to `text-mini`, so the zones follow the theme's text size change too. **Checked in a running game (Pop-Art, Rhino scenario):** the villain zone, the side-scheme zone, the hero zone with its stat buttons and the tableau show no overflow or overlap at the new sizes; the role audit (temporary Kalam Body) flags nothing in the three zone files. It still flags text that belongs to later batches: the top bar's "DEV MODE" label, the hand tray ("DISCARD:", the deck count), the card view badges ("CANNOT PLAY", the KEEP badge) and the combat log drawer's filter pills (the drawer was themed in N5 but still has small `font-comic`; it goes into batch 5).
- **Batch 5 result (hand tray, top bar, villain phase stepper, combat log drawer and balloons, damage splash):** 30 small-text uses of `font-comic` moved to Body, the stepper root no longer sets Headlines for its all-small text, 9 fixed sizes became tokens; the top bar banners, the drawer title and the splash words keep Headlines (headline size). Role audit in a running game (temporary Kalam Body under Pop-Art): the only flags left are two badges inside the card view (batch 6).
- **Batch 6 result (the card components):** 20 small-text uses of `font-comic` moved to Body (`CardView` 14, `CardContextMenu` 2, `FacedownEncounterCard` 3, `CardAttachmentFan` 1), 24 fixed sizes became tokens (cards keep their own sizes: the card view resets the text size change to 0), the four zoom and large card size entries name `font-body`, and the two inline `[hero]` and `[alter-ego]` keyword spans in card text keep the Headlines font on purpose (explicit, sizeless). The context menu items stay explicit Headlines (sizeless buttons). These were the last two role audit flags from batch 5 (the "CANNOT PLAY" and pile count badges).
- **Batch 7 result (the rest, and the whole-UI guard):** the last fixed size (`ReportProblemModal`) became a token, and the guards now cover the whole themed UI: every file in `src/ui` except the card editor and the lab's own chrome (the lab's kits and previews stay in). A new file with small `font-comic` text, a fixed pixel size under 17px, or headline-size text with no font role fails the test at once; I confirmed it with a probe file. **N2 is done:** across the seven batches about 190 `font-comic` uses on small text moved to Body, about 150 fixed sizes became tokens, and every themed screen is covered by a test.
- **Guard additions:** the small-text guard now covers the theme layer and the kits, and a second rule fails when headline-size text names no font role.
- **Visible change:** **none in any theme**: after D9 every theme's Body is the same font as its Headlines, so moving small text from `font-comic` to Body changes no glyph. The step only makes the Body role true, so a future theme with two fonts works.
- **Decision D9 (done):** you compared Pop-Art small text in Inter in the lab (wider, truncated card names, less pop-art character) and kept Lilita One. Pop-Art's Body is Lilita One.
- **Risk:** high by volume, low by effect. Hence batches and the guard.
- **Simplification & refactor check:** a plain `div` with no font class already inherits Body after N1, so most replacements are deletions, not renames.

### N4. Board, zones, hand tray and setup join the themes (own plan)

**The plan and its phases are in [PLAN_board_theming.md](./PLAN_board_theming.md)** (approved by you with the whole plan).

- Fonts follow the slots the same way (N1 to N3 prepare it). The rest (panels, ribbons, counters, buttons, table background, setup chrome) is the theme engine's open follow-up (`PLAN_theme_engine.md`, phase 6) and the audit's decisions D3, D4 and D7. It gets its own plan and approval; only the font contract is fixed here.
- **Includes your N8 rule:** the intro banner is excluded, everything else on that screen follows the theme.

### N7. Player font choice (decision D8)

- Open, by choice: tracked as issue #374. It needs its own short plan (which roles can be overridden, how it interacts with Random per game, where it is stored).

## 5. Quality gates for every step

- Targeted tests while working (`vitest run <files>` or `vitest related`), lint and typecheck once per finished step, `docs:fonts` and `docs:check` when the font docs change. The full suite runs in the push hook.
- No skipped tests, no `audit.comment` changes, no shims or second paths.
- A changelog fragment in `changes/unreleased/` per user-visible step.
- Each step ends with the lab and the game checked in the browser on at least Pop-Art and one other theme, with the viewport reset afterwards.

## 6. Debt removed (whole plan)

- The Body role stops being unused (13 uses, 0 on the page base).
- 16 direct `font-serif` uses and the "headline font for small text" habit (144+ uses) are gone, and guards stop them coming back.
- The font variables are set in one place at the game root instead of per surface.
- The editor boundary becomes a test.

## 7. Decisions I need from you

| #   | Question                                                                                                 | My recommendation                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| D9  | Pop-Art small text: Inter (the validated Body) or Lilita One?                                            | **Decided by you: Lilita One** (the Inter preview was wider and truncated card names)                |
| D10 | Before N4, the first-screen theme choice takes effect when the game starts, not live on that screen: OK? | **Yes**                                                                                              |
| D11 | N3 scope: fonts and sizes only, or the full Newspaper kit (eras)?                                        | **Fonts and sizes only**; the kit is a separate plan                                                 |
| D12 | N5: the combat log font setting?                                                                         | **Decided by you: remove it; the log follows the theme** (my recommendation to keep it is withdrawn) |
| D13 | Order: start with N6 then N1 as proposed?                                                                | **Yes**                                                                                              |

Back to the [font plan](./PLAN_fonts.md).
