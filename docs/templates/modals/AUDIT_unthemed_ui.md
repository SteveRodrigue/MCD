# Audit: what the theme engine does not cover yet

Date: 2026-10-23. Scope: everything under `src/ui/` (83 `.tsx` files), the global style layer
(`src/ui/styles/index.css`, `tailwind.config.js`) and the theme model itself.
Status: **audit only. Nothing here has been changed.** Decisions are in section 8; the plan comes after you decide.

## 1. Method

- Listed every `.tsx` file and whether it reads the theme (`useModalStyle`, `ModalScaffold`, `ThemePicker`, `useCardAccent`).
- Counted hard-coded look in each file: `bg-white`, `bg-comic-paper` or amber tints, `border/text-comic-black`,
  `shadow-comic-*`, `slate/gray` colours. A high count means the file draws its own palette.
- Read the main-area components section by section to name the elements, not just the files.
- Checked the global CSS utilities, fonts and the hero colour palette that already tints the board.

**Result: 33 of 83 files use the theme (all modals, the top bar, the pickers). 50 do not.**

## 2. Where we are, by area

| Area | Files | Lines | Themed? | Hard-coded look (count) |
|---|---|---|---|---|
| Modals and dialogs | 28 | ~9,000 | **Yes** (scaffold + tokens) | residual only, see section 7 |
| Top bar, dev banner | 2 | 330 | **Yes** | small residue |
| Play area (table, zones, hand tray, stepper) | 8 | 3,887 | **No** | 318 |
| Cards on the board (card view, menu, fan, thumbnail) | 6 | 1,244 | **No** | 114 |
| Combat log (drawer, entries, formatter) | 3 | ~1,340 | **No** | 84 + 7 hex colours in the formatter |
| In-universe newspapers (Daily Bugle, end-turn) | 2 | 663 | **Exempt** (ADR-0056 tier 2) | 100 |
| Setup (scenario selector, mulligan, loaders) | 3 | ~1,300 | **Partly** (picker only) | 197 |
| Supplemental editor (dev tool, `/editor`) | 20 | 5,604 | **No** | 394 |
| Template lab (`/templates/`) | 12 | ~1,200 | its own chrome | n/a |

## 3. The play area (not themed)

`GameBoard.tsx` (788 lines) frames the table; `HeroZone.tsx` (1,255), `VillainZone.tsx` (565) and `PlayerHandTray.tsx` (732)
are the three big zones. Elements, grouped by kind:

**Table and containers**
1. Table background: `bg-comic-paper` on `GameBoard` and `App`, plus a fixed halftone overlay (`bg-bendy-dots`), plus three loader screens.
2. Zone panels: the `.comic-panel` global class (white, 3px black border, 5px black shadow) on hero zone, villain zone, hand tray, removed-from-game box.
3. Zone title ribbons: the tab that sits on top of each zone (hero name, "SEAT n", "WAITING", "ACTIVE HERO", "UNDER ATTACK"; villain and hand tray equivalents).
4. Sub-panels: identity station, allies roster, tableau row, threat zone sub-zone, scheme panels, side-scheme area, pile sidebar.

**Counters, gauges and badges**
5. Stat counters: THW, ATK, DEF, HS, RES, REC columns on the hero; SCH and ATK on the villain.
6. Gauges: vertical HP gauge (hero, villain), vertical threat meter (main scheme) with colour transition.
7. Badge families: form badge, status badges (stunned, confused, tough), stage badge, "TEAM/VILLAIN" counters, `#N` and deck-count badges, DEFEATED and REMOVED ribbons.
8. Floating "EXTRA!" button (a newspaper-styled shortcut at the top left).

**Controls**
9. Action row: Suit Up / Flip, Recover, Attack, Thwart buttons; ally mini-console above an ally card; "Switch Active Hand" button.
10. Turn warning toast (mobile) and the villain phase stepper (step badge, Auto-play, Next step, Skip all).
11. Card context menu (right click): header, info rows, action list.

**Effects**
12. `ComicDamageSplash` (starburst "BANG! -3 HP" on a card). It is the same idea as our theme `fx` bursts but is hard-coded.

Notes that matter for design:
- **The hero colour palette already tints the zones** (`getHeroColorPalette`, from the upstream pack's `meta.colors`): ribbon colour, focus border, active hero badge, gauge colour. A theme must compose with it, not fight it.
- Text sits **directly on the table** in places (empty-hand message, seat captions, section headings), so a dark table needs each of those checked.
- Cards themselves (the art) are not themeable and stay as they are.

## 4. Cards on the board (not themed)

| File | What it draws |
|---|---|
| `CardView.tsx` (498) | selection and playable rings, exhausted look, token counters, boost-icon badges, hover zoom frame |
| `CardContextMenu.tsx` (368) | the right-click menu (uses `bg-comic-panel`, the only users of that colour besides the editor) |
| `FacedownEncounterCard.tsx` (166) | face-down stack, count badge, dev peek button |
| `CardAttachmentFan.tsx` (132) | fanned attachments, offsets and shadows |
| `CardArtThumbnail.tsx` (57) | **used by every themed modal**: black 2px border, amber background, comic shadow; on Night Edition and Hero HUD the black border disappears |
| `FormattedCardText.tsx` (23) | rich card text, slate colours |

## 5. Combat log and news (not themed; one part exempt)

- `CombatLogDrawer.tsx` (254): the right-hand drawer, dark slate masthead "DAILY BUGLE", filter pills, locale toggle, font cycle button, footer. Layered through `ModalLayer`.
- `ComicSpeechBalloon.tsx` (159): one log entry: speaker banner (colour from the hero palette or hard-coded), headline, dialogue quote, onomatopoeia, stat pills, source card.
- `utils/comic-log-formatter.ts` (923 lines): builds the entries; 7 hard-coded hex colours; speaker colours from the hero palette; font choice is a user setting that cycles Komika, Comic Relief, Comic Neue, Clean.
- `DailyBugleActionNewspaper.tsx` (583) and `EndTurnConfirmationModal.tsx` (80): the 1960s broadsheets. ADR-0056 tier 2 says they keep their newsprint look. **Direction given: keep the newspaper identity, but let it adapt to the theme (section 5b; D1, D6).**
- The log drawer **is** the in-universe "Daily Bugle chronicle", which is why it was left out of the modal migration. It is also the largest remaining surface on screen at all times.

## 5b. The Newspaper kit (direction given)

The Daily Bugle surfaces keep their intent: **a newspaper or a news site, never a normal modal.** What changes with the
theme is the *era* of the paper, from old-school print to futuristic feed. What never changes is the newspaper identity.

**Fixed page structure (user direction):** the action sheet keeps the engine's three columns in every theme: front page, classifieds, and the Call for Action! column. A theme restyles the columns, never removes or merges them.

**Identity rules (every theme, every Bugle surface):**
1. A nameplate or masthead with the title (THE DAILY BUGLE), and an edition line (round, phase, date or issue number).
2. A headline hierarchy: headline, standfirst or subhead, byline or dateline, body.
3. News structure: columns or a feed, section labels (Front page, Wire, Classifieds), rules and dividers between stories.
4. The content is written as stories (dispatches, extras, bulletins), not as buttons and form rows.
5. News furniture: ticker or "EXTRA!" flash, pull quotes for dialogue, boxed classifieds for stat pills.

**Era per theme (a starting proposal to review in the lab):**

| Theme | The Bugle as... |
|---|---|
| Pop-Art | the 1960s broadsheet we have now (halftone, serif masthead, red and blue ink) |
| Storyboard | a comic-strip newspaper page: panelled stories, caption boxes |
| Newsprint | the most literal old-school paper: aged stock, double rules, wood-type headlines |
| Night Edition | a dark news site ("Bugle Online"): night mode, neon section tags, card-style stories |
| Splash Page | a tabloid: giant EXTRA! banner, burst-shaped flashes, big photo-style card slots |
| S.H.I.E.L.D. Dossier | a wire service printout: teletype type, stamped bulletins, "FLASH" priority labels |
| Hero HUD | a holographic news feed: scrolling ticker, glowing headline bars, data-panel stories |

**Surfaces in the kit:** `DailyBugleActionNewspaper` (the action sheet), `EndTurnConfirmationModal` (the end-turn broadsheet),
`CombatLogDrawer` and `ComicSpeechBalloon` (the wire: entries are articles), the floating EXTRA! shortcut and the top bar's Daily Bugle button.

**Model:** a `newspaper` token group per theme: stock (paper or screen), ink colours, masthead layout and type, rule style,
column or feed layout, headline and body type roles, flash/EXTRA style, story card, section label, ticker. The speaker banner
colours of log entries still come from the hero palette (D2). The lab gets a **Newspaper kit** page that previews every Bugle
surface in every theme, with the era shown side by side so the "still a newspaper" test is visual.

## 6. Setup, shell and tools

- `ScenarioSelector.tsx` (718): the comic-book two-page spread, carousel arrows, deck picker, launch bar. Only the theme section was added (1 file, 197 fixed-style hits).
- `MulliganScreen.tsx` (276): seat tabs, hand grid, confirm buttons, launch bar.
- `App.tsx`: three "Loading..." screens on `bg-comic-paper`.
- `ModalTemplatesScreen.tsx` (the lab): its own dark slate chrome; intentionally not themed.
- **Supplemental editor** (`/editor`, 20 files, 5,604 lines): a developer tool for card data. Dense forms, filter builders, JSON editor. It uses `bg-comic-panel`, `border-3` (7 uses, which render nothing) and slate colours. **Decision point (D5): theme it or leave it as a tool.**

## 7. Residual gaps inside surfaces we already themed

- `CardArtThumbnail` (section 4): fixed border and shadow in every theme.
- Fixed palette in migrated files, by design or by leftover. By design (kept on purpose): damage red, heal green, threat blue, status badge colours, stat pills. Leftover candidates: `TopBar` (Daily Bugle button, dev toggle: slate), `DecisionPromptModal` (13 slate, 15 ink: matchup panel, revealed-card ring), `CardPaymentModal` (resource pills), `RemovedFromGameBox` (tabs), `CombatBoostModal` (damage banner is hard black).
- `border-3` still appears in 6 files (`ComicDamageSplash` 2, `VillainPhaseStepper` 1, `CardContextMenu` 1, `CardView` 1, `DualCardInspector` 7, `ScenarioSelector` 1): it is not a Tailwind utility, so those borders render nothing today.
- `ModalLayer` stacking and `z-layers` are fine; the lab bar workaround stays.

## 8. The theme model: what is missing

Today `ModalStyle` (in `src/ui/theme/modal-styles.ts`) describes **modals**: frame, header layouts, panel, inset, chip, option row, tile, slot, buttons, comic flavour, card accents, verb colours. The name is already wrong: it is used by the top bar.
To cover the board it would need, at least:

| Missing token or concept | Needed for |
|---|---|
| `table` (background colour, texture, overlay) | table, loaders, text-on-table colour |
| `zone` (panel, ribbon/tab, sub-panel) | hero, villain, hand tray, removed box |
| `counter` and `gauge` (stat counter, vertical meter, thresholds) | THW/ATK/DEF..., HP, threat |
| `badge` families (status, keyword, count, ribbon) | all badges |
| button families (primary, secondary, danger, icon, toggle, segmented) | action row, stepper, toggles, menus (today only `btnGo`, `btnMove`) |
| `menu` / popover / toast | context menu, ally mini-console, turn warning |
| form controls (input, textarea, select, checkbox, switch) | report form, editor, setup |
| `logEntry` (banner, quote, pills) and drawer shell | combat log |
| `newspaper` group (stock, ink, masthead, rules, columns or feed, headline type, flash, ticker) | Daily Bugle sheet, end-turn broadsheet, combat log drawer and entries, EXTRA! shortcut |
| `splash` unified with `fx` | `ComicDamageSplash` |
| typography roles (display, body, mono, caption) | themes only set a family on the modal frame; the board uses `font-comic` 251 times |
| density / radius / border-width scale | consistency across themes |
| composition rule with the hero palette | hero-coloured ribbons and gauges |
| semantic colours that never change | damage, heal, threat, exhausted, selected |
| neutral name (`ThemeStyle`) | the model is not only for modals any more |

## 9. The template lab: what it does not preview

Today the lab shows **3 modal types** (Decision, Sequence, Select) on 7 themes. Unwatched elements:

- **Modals not previewed** (they exist and are themed): target picker, card action menu (ally, tableau, identity), combat resolution, distribute points, simultaneous order, card payment, pile viewer, options, report, confirm, game over, infinite loop.
- **Board kit** (not previewable): table, hero zone, villain zone, hand tray, stat counters, gauges, badges, stepper, context menu, toast, damage splash, floating shortcut.
- **Newspaper kit**: the action sheet, the end-turn broadsheet, the log drawer with one entry per type, the EXTRA! shortcut and the top bar button, in every era, next to each other.
- **Setup kit**: scenario selector spread, mulligan.
- **Element sheet**: every button, badge, input and toggle in every state (default, hover, disabled, selected) per theme, so a theme can be judged at a glance.

## 10. Decisions to take (with my recommendation)

| # | Question | Options | Recommendation |
|---|---|---|---|
| D1 | Combat log | (a) theme it like everything else; (b) keep it as the in-universe Daily Bugle; (c) it joins the **Newspaper kit** (D6): themed, but still a news page | **(c)**: it is on screen all game, so it must follow the theme, and it must still read as the Bugle's wire |
| D2 | Hero palette vs theme | palette overrides theme / theme overrides palette / palette is an accent on a theme | **Accent on a theme**: theme owns structure, shadows, texture; palette colours ribbons, gauges and focus rings |
| D3 | Table background in dark themes | one table colour per theme and fix each text-on-table spot / keep the table light and only tint it | **Per-theme table** with an audited list of text-on-table spots (about a dozen) moved onto panels |
| D4 | How to restyle the board | (a) token classes in every component as for modals; (b) CSS variables behind the shared utilities (`.comic-panel`, buttons); (c) first extract board primitives (Panel, Ribbon, Counter, Gauge, Badge, Button) then theme those once | **(c)**: the board has about 200 inline `border-comic-black` and 160 `shadow-comic` uses; primitives remove that debt and make the lab mockups real components |
| D5 | Supplemental editor (`/editor`) | theme / leave as a tool | **Leave as a tool** for now; fix its `border-3` no-ops; revisit later |
| D6 | Daily Bugle (action sheet, end-turn broadsheet, combat log drawer, EXTRA! button) | keep exempt / theme like a modal / **theme as a Newspaper kit**: every theme gets its own era of newspaper, the newspaper identity never changes | **Newspaper kit** (see section 5b). Your direction: it adapts from old-school to futuristic, but stays "a newspaper or news site", never a plain modal |
| D7 | Setup screens | theme / keep the comic-book spread | **Theme the chrome** (panels, buttons, banners) and keep the "open comic book" idea as part of the Pop-Art and Storyboard themes |
| D8 | Rename `ModalStyle` to `ThemeStyle` and the folder docs | yes / no | **Yes**, in the first step |
| D9 | `ComicDamageSplash` | keep / unify with `fx` bursts | **Unify** (one burst system, themed words and shapes) |
| D10 | Fonts | keep `font-comic` everywhere / typography roles per theme | **Roles per theme** (display, body, mono), with the existing font-cycle setting only affecting the log entries |

## 11. Bug found while auditing (goes into the plan as step 0)

**Payment modal: resource generators show a placeholder instead of their card thumbnail.**

- **Where:** `CardPaymentModal.tsx`, "Identity & Table Resource Generators", `ChoiceCard code={gen.id.split('_')[0]}`.
- **Cause:** a generator's `id` is the card's *instance id* (or the literal `identity_ability`), not its card code, so the text before the first `_` is not a code and the thumbnail falls back to its placeholder. The generator list (`availableGenerators`) never records the card code. The code was wrong before the theme work; the migration kept it.
- **Fix (in the cause, not the symptom):** add `code` to every generator entry when the list is built (`c.card.code` for table cards, `player.activeFormCard.code` for the identity ability), use it for the thumbnail and the accent, and delete the `split('_')` guess.
- **Test:** a payment modal test with a hand of generators (identity ability, an upgrade that generates resources, a card that spends counters) asserts each row shows the thumbnail of its own card, under every theme; it fails on the placeholder.
- **Same family:** this is a Card Anchoring Rule gap. The same pass checks the other choice lists in the modal (hand cards, discard cards, target buttons) for a missing or derived code.
- **Size:** small, independent of the theme work, so it ships first as its own commit.

## 12. Proposed shape of the plan (for your review, not started)

Step 0 is the payment generator thumbnail fix above. Then, lab first, so every surface is previewed and adjusted before the game is touched:

1. **Model**: rename to `ThemeStyle`, add the tokens of section 8, keep every current theme visually identical.
2. **Primitives**: Panel, Ribbon, Counter, Gauge, Badge, Button family, Menu, Toast, form controls, each reading tokens.
3. **Lab kits**: Elements sheet, Modals kit (the missing 12), Board kit, **Newspaper kit** (sheet, broadsheet, log), Setup kit; navigation grows from 3 modal types to kits.
4. **Retrofit** in this order, each ending with the lab mockup and the game matching: table and zones, counters and gauges, hand tray and menus, log drawer and entries, setup screens, cleanups (`border-3`, `CardArtThumbnail`, loaders).
5. **Guards**: matrix tests extended to the board kit; a guard that fails on new `bg-white` or `shadow-comic` in themed surfaces; ADR-0091 amended.

Effort, roughly: model and primitives 1 to 2 sessions, lab kits 2, retrofit 4 to 6, depending on D4 and D5.
