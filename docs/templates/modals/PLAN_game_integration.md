# Plan: bring the validated fonts and sizes into the game (N1 to N9)

Status: **proposed, waiting for your approval. Nothing below is implemented.** Each step is a separate, reviewable change; none is committed unless you ask.

Related: [Font plan](./PLAN_fonts.md) (phases 1 to 6 are done), [Font record](./FONT_RECORD.md), [Theme engine plan](./PLAN_theme_engine.md), [Unthemed UI audit](./AUDIT_unthemed_ui.md).

## 1. What this plan covers, and what it does not

| In this plan                                                                                                   | Not in this plan                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Making the game screens read the theme's fonts and text sizes (N1, N2, N3, N5)                                 | Restyling the board, zones and hand tray beyond fonts: the theme engine plan and the audit own that (N4 only fixes the font contract) |
| Your two additions: only the intro banner keeps its look (N8), and the theme selector on the first screen (N9) | Gameplay rules: this is presentation only, the engine (`src/engine/`) is not touched, so the Rules Reference does not apply           |
| Keeping the card editor out of the themes (N6)                                                                 | A font choice for players (N7, later)                                                                                                 |

UI impact: every visible change is listed per step. Card Editor impact: none, and that is enforced by a guard (N6).

## 2. What the code looks like today (measured)

- The theme is already app-wide: `ThemeProvider` (`src/ui/theme/ThemeProvider.tsx`) gives every component the active style, but only modals, previews and the lab set the font variables (`themeFontVars`). The game root does not.
- The page base is `font-sans` (the system sans) on the `App.tsx` root. `font-body` has 13 uses. The `:root` default of Body is Inter.
- `font-comic` (Headlines) has **266 uses in 48 files**. On the same line as a small size token (`text-xs`, `text-sm`, `text-nano`, `text-micro`, `text-mini`): **144**. With a headline size: 35. With no size on the line (the size is on a parent): **87**.
- `font-serif` (Daily Bugle): 16 uses in 4 files (`DailyBugleActionNewspaper` 10, `EndTurnConfirmationModal` 3, `GameBoard` 2, `TopBar` 1).
- `font-bangers`: 26 uses in 13 files (the editor has 17 of them).
- The combat log has its own player setting (Bangers, Komika, Comic Relief, Comic Neue, Clean) in `combat-log-presets.ts`.
- The first-screen theme picker exists (`ScenarioSelector.tsx`, a collapsed "Theme:" panel).
- The card editor (`/editor`) uses `font-sans`, `font-bangers` and `font-mono` (for code and JSON).

## 3. Order, by dependency

```
N6 guard ──> N1 ──┬──> N8 ──┐
                  ├──> N9   ├──> N2 ──> N4 ──> N7 (later)
                  ├──> N5   │
                  └──> N3 ──┘
```

| Order | Step                                                             | Size (agent work, then your review)  | Depends on | Risk                                                 |
| ----- | ---------------------------------------------------------------- | ------------------------------------ | ---------- | ---------------------------------------------------- |
| 1     | **N6** Keep the editor out of the themes                         | S: about 15 min                      | none       | low                                                  |
| 2     | **N1** Make Body real, set the theme variables at the game root  | S to M: about 45 min                 | N6         | medium: a visible change everywhere text has no font |
| 3     | **N8** Pin the intro banner to Bangers                           | S: about 20 min                      | N1         | low                                                  |
| 4     | **N9** Theme selector visible on the first screen                | M: about 1 h                         | N1         | low to medium                                        |
| 5     | **N5** Combat log fonts: decision, no code                       | XS: about 10 min                     | N1         | low                                                  |
| 6     | **N3** Daily Bugle surfaces read the Newspaper pair (font slice) | M: about 1.5 h                       | N1         | medium                                               |
| 7     | **N2** Small `font-comic` text becomes Body, with a guard        | L: about 3 to 4 h, in 6 to 8 batches | N1, N8, N3 | **high**: Pop-Art look changes (D9)                  |
| 8     | **N4** Board, zones, hand tray and setup join the themes         | XL: days, **its own plan**           | N1, N2, N3 | high                                                 |
| 9     | **N7** Player font choice (D8)                                   | later                                | N4         | n/a                                                  |

## 4. The steps

### N6. Keep the editor out of the themes (first, so N1 cannot leak into it)

- **Problem:** N1 sets font variables at the game root. If it wrapped the editor, `font-mono` (JSON, code) there would turn into Nunito.
- **Change:** the game stages (setup, mulligan, in game) are wrapped by the theme variables; the editor (`/editor`) and the lab (`/templates`, dev only) are not. A guard test reads `src/ui/components/editor/` and fails if a file names a theme role (`font-comic`, `font-body`, `font-news-*`, `text-nano`, `text-micro`, `text-mini`).
- **Files:** `src/ui/App.tsx`, one new test in `tests/ui/`.
- **Debt removed:** an unwritten rule ("the editor is not themed") becomes a test.

### N1. Make Body real, and set the theme variables at the game root

- **Change:**
  1. A small wrapper component sets `themeFontVars(style)` on one element around the game stages, as `ModalScaffold` and `ThemedTable` do. Everything inside, not only modals, then follows Headlines, Body, Numbers & codes, and the size changes.
  2. The page base changes from `font-sans` (system sans) to `font-body`, so unlabelled text follows the theme's Body (decision D5, already approved).
  3. `ThemedTable` and `ThemePreview` stop setting the variables by themselves where the wrapper already does (one source, no duplicate path).
- **Files:** `src/ui/App.tsx`, `src/ui/theme/ThemeProvider.tsx` (or a new wrapper next to it), `src/ui/theme/kit/surfaces.tsx`, `tailwind.config.js` (no change expected), 1 or 2 tests.
- **Visible change:** text with no explicit font (setup labels, board text) goes from system sans to the theme's Body. For Pop-Art that is Inter, for the other six themes their own font. This is the intended D5 result.
- **Risks:** the Random theme roll happens when a game starts, so before a game the first-screen theme is the saved one; the wrapper must read the active style, never the roll alone. The `cards` rule (`[data-card-view]` resets the size change) already protects card faces.
- **Simplification & refactor check:** the variables are set in one place instead of four (`ModalScaffold`, `ThemePreview`, `ThemedTable`, the new wrapper); the three keep only what is specific to them.
- **Tests:** the wrapper sets the variables for each of the 7 themes; the page base is `font-body`; the editor is not inside the wrapper (N6).

### N8. Only the intro banner keeps its look

- **Change:** in `ScenarioSelector.tsx` (lines 132 to 140), the three banner elements use `font-bangers` instead of `font-comic`, so they never follow a theme. Their colours are Tailwind constants (`comic-yellow`, `comic-red`, `comic-blue`) and do not change with a theme. The rest of the screen follows the theme (N4).
- **Visible change:** none today (Bangers is the default); it only protects the look once the screen is themed.
- **Files:** `src/ui/components/setup/ScenarioSelector.tsx`, one test.
- **Tests:** the banner elements carry `font-bangers` and not `font-comic`; rendered under each of the 7 themes, the banner classes are identical.
- **Risk:** low. The banner sizes are headline-sized (`text-xl` and up), so a theme's Body size change cannot move them.

### N9. The theme selector on the first screen

- **Change:** the "Theme:" panel in `ScenarioSelector.tsx` is no longer collapsed in a `<details>`; the 7 themes and "Random each game" are visible on the first screen, with the current choice marked. The choice is saved with the settings (`themeMode`, `themeId`, as today) and is used when the game starts (`rollGameTheme`, as today).
- **Visible change:** a new, always-open block on the first screen, below the scenario spread and above the launch bar. The banner stays as it is (N8).
- **Files:** `src/ui/components/setup/ScenarioSelector.tsx`, maybe `ThemePicker.tsx` (a `compact` look if the panel is too tall), tests.
- **Tests:** the picker is reachable before a game starts; clicking a theme saves it; "Random each game" saves; the launch bar still starts the game with that theme.
- **Risk:** the first-screen layout gets taller (the picker has 8 tiles). **Decision D10:** until N4, a chosen theme takes effect when the game starts, not on the first screen itself. After N4 the first screen follows the selection live.

### N5. Combat log fonts (decision, no code)

- **Recommendation:** leave the log's own font setting alone (Bangers, Komika, Comic Relief, Comic Neue, Clean). It is a player choice about the log entries only (audit decision D10), so it is not a theme slot. The log drawer, its filters and its masthead become part of the Newspaper work (N3) and N4.
- **Change:** record the decision in the font record; a test keeps `combat-log-presets.ts` as the only place those families are named.
- **Alternative:** a sixth preset, "Theme", which follows the theme's Body. Small, but it is a new setting; only if you want it.

### N3. Daily Bugle surfaces read the Newspaper pair (the font slice only)

- **Change:** `DailyBugleActionNewspaper`, `EndTurnConfirmationModal`, the top bar's Bugle button and the floating EXTRA! button are wrapped like `NewspaperSheet` is in the lab (it sets `newspaperFontVars`), and their `font-serif` (16 uses) becomes `font-news-body` or `font-news-headline`. A `font-mono` on them follows Numbers & codes.
- **Visible change:** in Pop-Art nothing (the Newspaper pair is the system serif, as now). In the other six themes the Daily Bugle is drawn in the theme's font, with the Splash body +4 and Dossier headlines -1.
- **Not included:** the full Newspaper kit (eras per theme, layout) from the audit (decision D6). That is a separate, larger plan; this step only makes the fonts and sizes right and keeps the three-column rule.
- **Files:** 4 components (`DailyBugleActionNewspaper.tsx` 583 lines, `EndTurnConfirmationModal.tsx`, `TopBar.tsx`, `GameBoard.tsx`), the guard test (`font-serif` is forbidden in the game).
- **Risk:** medium. `DailyBugleActionNewspaper` has existing tests and the three-column layout; sizes change with the theme's newspaper size change (the layout must not overflow at Splash +4).
- **Simplification & refactor check:** the lab's `NewspaperSheet` wrapper is reused, not copied.
- **Tests:** no `font-serif` left in `src/ui`; the wrapper sets the newspaper variables per theme; the existing Daily Bugle tests still pass.

### N2. Small `font-comic` text becomes Body (the large, mechanical step)

- **Why:** today 97% of modal text and most board text uses the Headlines font, so the Body font is invisible. The size rule (decision D4) says: text under 17px is Body, 17px and up is Headlines.
- **Change:** the 144 small uses (and the 87 where the size is on a parent, found by reading each file) move from `font-comic` to `font-body` or are removed where the base text already is Body (after N1, plain text already follows `font-body`). A guard test fails when one className has both `font-comic` and a small size token.
- **Batches (each reviewed in the lab or the game):** 1) the 20 themed modals, 2) the theme layer and kits, 3) setup (ScenarioSelector, Mulligan), 4) hero and villain zones, 5) hand tray, top bar, stepper, 6) cards and context menu, 7) the rest.
- **Visible change:** **only Pop-Art changes**, because it is the only theme whose Body (Inter) differs from its Headlines (Lilita One). Its small modal labels go from Lilita One to Inter. The six other themes use one font for both, so nothing changes there.
- **Decision D9, before this step:** you validated Pop-Art while its small text was still Lilita One everywhere. Before I move it, I show the same screens with Inter small text in the lab (the lab already does it with the Body test font) and you confirm. If you prefer Lilita One for small text in Pop-Art, the Body of Pop-Art becomes Lilita One (a one-line change) and N2 changes nothing visible.
- **Risk:** high by volume, low by effect. Hence batches and the guard.
- **Simplification & refactor check:** a plain `div` with no font class already inherits Body after N1, so most replacements are deletions, not renames.

### N4. Board, zones, hand tray and setup join the themes (own plan)

- Fonts follow the slots the same way (N1 to N3 prepare it). The rest (panels, ribbons, counters, buttons, table background, setup chrome) is the theme engine's open follow-up (`PLAN_theme_engine.md`, phase 6) and the audit's decisions D3, D4 and D7. It gets its own plan and approval; only the font contract is fixed here.
- **Includes your N8 rule:** the intro banner is excluded, everything else on that screen follows the theme.

### N7. Player font choice (decision D8)

- Later, after N4. Not planned here.

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

| #   | Question                                                                                                 | My recommendation                                                                      |
| --- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| D9  | Pop-Art small text: Inter (the validated Body) or Lilita One?                                            | Preview Inter in the lab first, then decide; I expect Inter reads better at 10 to 13px |
| D10 | Before N4, the first-screen theme choice takes effect when the game starts, not live on that screen: OK? | **Yes**                                                                                |
| D11 | N3 scope: fonts and sizes only, or the full Newspaper kit (eras)?                                        | **Fonts and sizes only**; the kit is a separate plan                                   |
| D12 | N5: leave the combat log font setting alone, or add a "Theme" preset?                                    | **Leave it alone**                                                                     |
| D13 | Order: start with N6 then N1 as proposed?                                                                | **Yes**                                                                                |

Back to the [font plan](./PLAN_fonts.md).
