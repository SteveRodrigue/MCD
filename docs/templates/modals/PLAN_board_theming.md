# Plan: the board, the setup and the shell follow the theme (N4)

Status: **approved by you (whole plan, "the full UI follows the theme, only the Bangers banner is kept"). Phases 1 to 4 are done (kit, tokens, guard, villain zone, hero zone, hand tray, removed box); phase 5 (shell) is next.** Each phase is a separate change, committed on its own, and verified in the running game.

Related: [Game integration plan](./PLAN_game_integration.md) (N4 is its last big step), [Font plan](./PLAN_fonts.md), [Unthemed UI audit](./AUDIT_unthemed_ui.md) (the measurements and the decisions D1 to D10 this plan applies), [Theme engine plan](./PLAN_theme_engine.md).

## 1. Goal and rules

Everything the player sees, except the Bangers "MARVEL CHAMPIONS" banner (N8), follows the selected theme: its frames, panels, ribbons, chips, buttons, empty slots, textures, table and text colours, as well as its fonts and text sizes (done in N1 to N3, N5 and N2). The card editor and the lab's own chrome are not themed.

Rules, from the audit decisions you accepted:

1. **The theme owns the structure; the game owns the meaning.** Panels, borders, shadows, radii, ribbons, chips, buttons and slots come from the theme tokens (`ModalStyle`, `ThemeExtras`). Colours that carry a game meaning never change with the theme: damage red, heal green, threat, exhausted, selected, the Scheme blue and Attack red of the stat boxes, status badges (Tough, Stunned, Confused).
2. **The hero palette is an accent on a theme (D2):** it colours the zone ribbon edge, the hero's gauges and the active outline, never the panel itself.
3. **One kit, no copies.** The real components use the lab's kit (`ZonePanel`, `Ribbon`, `Badge`, `ThemedButton`, `Gauge`, `StatCounter`, `ThemedMenu`, `ThemedToast`, `ThemedSplash`, `ThemedTable`, the fields) and the `ModalStyle` tokens through `useModalStyle()`. New looks are added as tokens, not as literal class strings in a screen.
4. **A guard fails when a literal look comes back** in a migrated file (a fixed `bg-white`, `border-comic-black`, `shadow-comic*` or `comic-panel` outside the allowed semantic cases), as the font guards do.
5. **Text colour follows the surface.** Text that sits on a theme surface uses `style.text`, `style.muted` or `style.emphasis`, never a fixed `text-comic-black` or `text-slate-*`, so dark themes stay readable.

## 2. Phases

| #   | Phase                                 | What changes                                                                                                                                                                                                                                                                                                                                                      | Verified by                                    |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | **Kit and tokens** (done)             | `ZonePanel` gets an icon, an accent colour and a body class; the `ModalStyle` gets one new token, `badge` (the shape of a small badge without colours, for badges whose colour carries a game meaning); the other needs (empty slot, count pill, sub-panel) reuse `inset`, `chip` and `muted`; the guard `tests/ui/theme-guards.test.ts` lists the migrated files | unit tests of the kit; guard test              |
| 2   | **Villain zone** (done)               | zone panel and ribbon, discard and deck slots, villain panel, scheme and side scheme panels, count pills, threat subzone                                                                                                                                                                                                                                          | running game under the 7 themes; related tests |
| 3   | **Hero zone**                         | zone panel with the hero accent, stat and action buttons, tableau, ally and upgrade panels, ready, exhausted and active states                                                                                                                                                                                                                                    | same                                           |
| 4   | **Hand tray, removed box, piles**     | tray frame and ribbon, hand header, draw and discard slots, the removed-from-game box, the pile buttons                                                                                                                                                                                                                                                           | same                                           |
| 5   | **Shell**                             | top bar remainder, floating buttons (EXTRA!, side arrows), villain phase stepper, card context menu (`ThemedMenu`), toasts, damage splash (`ThemedSplash` and the burst)                                                                                                                                                                                          | same                                           |
| 6   | **Setup**                             | scenario spread, deck and difficulty panels, launch bar, mulligan; the Bangers banner stays; loaders                                                                                                                                                                                                                                                              | same, first screen under 7 themes              |
| 7   | **Table**                             | the page behind everything: background, texture and text colour from the theme (`ThemedTable`), replacing `bg-comic-paper` and the halftone overlay                                                                                                                                                                                                               | whole game under 7 themes, contrast audit      |
| 8   | **Combat log drawer and Daily Bugle** | the drawer chrome and the action sheet adopt the Newspaper kit era of each theme (audit D1 and D6)                                                                                                                                                                                                                                                                | newspaper tests, running game                  |

The table goes last on purpose: a dark table (Night, Hero HUD) is only readable once every surface on it is themed.

## 2b. What the kit gained while doing the zones

- `ModalStyle.badge` and `ModalStyle.buttonShape`: the shape (border, radius, shadow) of a small badge and of a compact button in each theme, without colours, so a badge or button whose colour carries a game meaning still looks like the theme.
- `StatBox` (THW, ATK, DEF, SCH, HS, RES, REC) and `StatStrip` (an ally's THW and ATK): one component replaces nine copies of the same markup in the hero and villain zones; the stat colours are fixed meanings.
- `ToneButton` (red, amber, blue, sky): the action buttons (Attack, Thwart, Flip, Suit Up, Recover, the ally mini-console, the tableau use button); coloured by what the action does, drawn in the theme's button shape, grey when disabled.
- `ZonePanel` (icon, accent, body class), used by the villain zone.
- The hero zone panel keeps its state signals as meanings: a red ring when under attack, a ring for the active hero, a dimmed panel for a waiting hero; its fill and border come from the theme.

## 3. Method for every phase

1. List the literal look classes of the files (colours, borders, shadows, radii, `comic-panel`) and mark each as theme (replace) or meaning (keep).
2. Replace the theme ones with kit components and tokens; text colours with the surface tokens.
3. Update the tests that assert literal classes (they must assert the role or the test id, not a colour).
4. Check the real game under the seven themes (screenshots), with a temporary check for text that does not read on its surface.
5. Add the migrated files to the guard; lint, typecheck and related tests; commit.

## 4. Debt removed

- About 700 literal look classes in 13 files become theme tokens.
- `comic-panel`, `bg-comic-paper` and the halftone overlay stop being written in screens.
- The two parallel looks (modals themed, board not) become one.

## 5. Risks

| Risk                                                             | Handling                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Hover zoom and stacking of cards inside a panel                  | the panel tokens do not clip; keep `hover:z-raised focus-within:z-raised` on the zone panel |
| Tests that assert literal classes                                | updated to assert role and test id in the same phase                                        |
| Dark themes: text on a fixed colour                              | rule 5 and the per-phase contrast check                                                     |
| Layout shifts from header bars replacing the overlapping ribbons | phase 2 is the pilot: review it under 7 themes before phase 3                               |
| Very large files (HeroZone 1,251 lines)                          | migrate by area inside the file, tests after each area                                      |
