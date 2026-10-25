# Font record: what can be set, and where

One page to check which fonts a theme has, which ones can be changed, and which cannot (yet). The table
"What each theme uses today" is generated from `src/ui/theme/modal-styles.ts` (`npm run docs:fonts`) and a
test fails when it is stale. The rest is written by hand and checked by `tests/tools/fonts-record.test.ts`.
The plan for the remaining font work is [PLAN_fonts.md](./PLAN_fonts.md).

**Legend:** ✅ can be set today · ❌ cannot be set today (reason given) · 🔒 fixed on purpose.

## The rule

Each theme has a **default pair**: one **Headlines** font and one **Body** font, both required.
The **Newspaper** (Daily Bugle) can have its own pair. It is an exception, not a second theme:

1. A newspaper surface uses the **Newspaper Headlines** font if the theme sets one, otherwise the theme's **Headlines**.
2. A newspaper surface uses the **Newspaper Body** font if the theme sets one, otherwise the theme's **Body**.
3. Everything else uses the theme's Headlines and Body.
4. **Numbers & codes** (counters, badges, key caps, card codes) use the theme's Numbers font if it sets one,
   otherwise the system monospace.

There is no separate "Serif" slot: the serif typeface was only ever used by Daily Bugle surfaces, so it is the Newspaper pair.

In the lab font test the same order applies: a Newspaper test font wins inside a newspaper, the general
test font applies everywhere else, and "Follow default" / "Theme font (default)" means "nothing set here".

## What can be set (the font picker)

| Slot                                                                                                                     | Plain meaning                                                                                                                      | Where it applies                                                                         | Lab font test (list + shortcut)                                                                                                     | Per theme in code                                                                                                                                                                | Player Options picker              |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Headlines**                                                                                                            | Titles and larger text                                                                                                             | Every themed surface: modals, previews, the lab's table                                  | ✅ list, **H** (**F** sets Headlines + Body)                                                                                        | ✅ `fonts.headline` (required)                                                                                                                                                   | ❌ no font setting for players yet |
| **Body**                                                                                                                 | Smaller text                                                                                                                       | Every themed surface                                                                     | ✅ list, **B**                                                                                                                      | ✅ `fonts.body` (required)                                                                                                                                                       | ❌ not yet                         |
| **Newspaper headlines**                                                                                                  | Daily Bugle titles and flashes                                                                                                     | The Daily Bugle sheet in the lab (`NewspaperSheet`)                                      | ✅ list, **N** (sets both newspaper fonts)                                                                                          | ✅ `fonts.newspaper.headline` (optional)                                                                                                                                         | ❌ not yet                         |
| **Newspaper body**                                                                                                       | Daily Bugle stories                                                                                                                | The Daily Bugle sheet in the lab                                                         | ✅ list, **N**                                                                                                                      | ✅ `fonts.newspaper.body` (optional)                                                                                                                                             | ❌ not yet                         |
| **Numbers & codes**                                                                                                      | Counters, badges, key caps, card codes                                                                                             | Anything that names `font-mono`                                                          | ✅ list, **M**                                                                                                                      | ✅ `fonts.numbers` (optional)                                                                                                                                                    | ❌ not yet                         |
| **Digits** (0-9 in Bangers text)                                                                                         | Readable 1 and 7 in the default headline stack                                                                                     | Only the default headline stack (Bangers)                                                | 🔒 fixed: Inter Bold (`Body Digits`, `index.css`)                                                                                   | 🔒 not a theme setting                                                                                                                                                           | 🔒                                 |
| **Combat log** (the drawer and its speech balloons)                                                                      | The combat log entries and drawer                                                                                                  | Every themed surface, through `ModalLayer`                                               | n/a                                                                                                                                 | ✅ follows the theme: Body for the dialogue, Headlines for banners and onomatopoeia, theme text sizes; no font setting of its own (the old font selector and Komika are removed) | ❌                                 |
| **The game's own Daily Bugle** (`DailyBugleActionNewspaper`, `EndTurnConfirmationModal`, the top bar and EXTRA! buttons) | The real game screens                                                                                                              | The same four surfaces                                                                   | n/a                                                                                                                                 | ✅ they read `font-news-headline` and `font-news-body` and carry the theme's newspaper text sizes (`useNewspaperProps`)                                                          | ❌                                 |
| **Board, hands, zones, setup screens**                                                                                   | The play area                                                                                                                      | n/a                                                                                      | ❌ not themed yet, so they ignore every setting above                                                                               | ❌                                                                                                                                                                               | ❌                                 |
| **Lab bar**                                                                                                              | The lab's own chrome                                                                                                               | n/a                                                                                      | 🔒 never changes                                                                                                                    | 🔒                                                                                                                                                                               | 🔒                                 |
| **Font per surface** (Options in one font, gameplay modals in another)                                                   | n/a                                                                                                                                | n/a                                                                                      | ❌ not supported: a theme has one pair (plus the Newspaper exception)                                                               | ❌                                                                                                                                                                               | ❌                                 |
| **Size** (px change on top of the game's size)                                                                           | Body-sized text (text-xs, text-sm, text-nano, text-micro, text-mini), headline-sized text (text-base and up) and numbers and codes | Every themed surface: modals, previews, the table, the newspaper. Cards keep their sizes | ✅ `-` and `+` at the right of each list, 1px steps from -4 to +8, click the value to clear; added on top of the theme's own change | ✅ `fonts.sizes` (`headline`, `body`, `numbers`, `newspaper.headline`, `newspaper.body`), all optional                                                                           | ❌ not yet                         |
| **Weight, letter spacing**                                                                                               | n/a                                                                                                                                | n/a                                                                                      | ❌ not part of the font test                                                                                                        | ❌                                                                                                                                                                               | ❌                                 |

## What each theme uses today

"follows" means the slot is not set for that theme and takes the value of the default pair.
The fonts and size changes were validated theme by theme in the readability review (phase 5 of the plan). This table is generated from the theme tokens: run `npm run docs:fonts` after changing a theme's fonts (the pre-commit hook does it, and a test fails when it is stale).

<!-- fonts-record:start (generated by `npm run docs:fonts`, do not edit) -->
| Theme | Headlines | Body | Newspaper headlines | Newspaper body | Numbers & codes | Text size change (px) |
|---|---|---|---|---|---|---|
| Pop-Art Action-Coded | Lilita One | Lilita One | **system serif (set)** | **system serif (set)** | Nunito | Body +1, Numbers +1 |
| Storyboard Panels | Kalam | Kalam | follows (Kalam) | follows (Kalam) | Nunito | Body +2, Numbers +1 |
| Golden Age Newsprint | Merriweather | Merriweather | follows (Merriweather) | follows (Merriweather) | Nunito | Body +1, Numbers +1 |
| Night Edition | JetBrains Mono | JetBrains Mono | follows (JetBrains Mono) | follows (JetBrains Mono) | Nunito | Body +1, Numbers +1 |
| Splash Page | Boogaloo | Boogaloo | follows (Boogaloo) | follows (Boogaloo) | Nunito | Body +3, Numbers +1, Newspaper body +4 |
| S.H.I.E.L.D. Dossier | Special Elite | Special Elite | follows (Special Elite) | follows (Special Elite) | Nunito | Body +2, Numbers +1, Newspaper headlines -1 |
| Hero HUD | Lexend | Lexend | follows (Lexend) | follows (Lexend) | Nunito | Body +1, Numbers +1 |

Themes that set a Newspaper font: Pop-Art Action-Coded. Every other newspaper follows its theme.
<!-- fonts-record:end -->

## Known gaps

- **Headline versus body is decided by the font utility, and a test keeps it true.** Headlines are text with
  an explicit headline size (`text-base` and up) that names `font-comic`; small text (`text-xs`, `text-sm`,
  `text-nano`, `text-micro`, `text-mini`) uses the Body font; text with no size and no font class is Body. A
  guard test covers the whole themed UI (everything in `src/ui` except the card editor and the lab's own
  chrome) and fails when small text names `font-comic` or headline-size text names no font role. Explicit
  sizeless `font-comic` stays where the author meant a title (menu buttons, a few labels, the inline `[hero]`
  and `[alter-ego]` keywords in card text).
- **The game screens set the theme on their root and on the modal layer.** The setup, mulligan and game
  screens carry the theme's font roles and text sizes (`GameThemeRoot`), and everything rendered through the
  modal layer (modals, drawers, newspapers) carries them too, because that layer sits outside the root.
  Unlabelled text is the theme's Body. The card editor and the lab chrome are outside the themes.
- **Digits** use the default body font (Inter) only inside the default Bangers stack. A theme that sets
  its own Headlines font does not use the digit face.
- **The Numbers & codes size change only reaches numbers that carry their own size class.** A `font-mono` span
  inside a sized parent (for example `7 HP` in the Decision modal) takes the parent's size, which follows the
  Body change. Counters that name both (`3 DMG`: `text-micro font-mono`) follow the Numbers change.
- **Players cannot choose fonts.** The Options picker sets the theme, not its fonts.

## Where to change things

| What                                                             | File                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A theme's Headlines, Body, Newspaper, Numbers & codes            | `src/ui/theme/modal-styles.ts`, the `fonts` token of the theme (`ThemeFonts`)                                                                                                                                                                                                                                      |
| How a theme's fonts reach the page                               | `themeFontVars`, `newspaperFontVars` (same file); `ModalScaffold`, `ThemePreview`, `ThemedTable`, `NewspaperSheet` set the CSS variables                                                                                                                                                                           |
| Font utilities and their variables                               | `tailwind.config.js` (`comic`, `body`, `mono`, `news-headline`, `news-body`), `src/ui/styles/index.css` (`:root` defaults, `@font-face`)                                                                                                                                                                           |
| The newspaper tokens use `font-news-headline` / `font-news-body` | `src/ui/theme/theme-extras.ts`                                                                                                                                                                                                                                                                                     |
| What you chose in the lab font test, saved for later             | the lab's "Save font choices" button writes `logs/lab/font-choices.json` (dev server only, one entry per style; `src/ui/components/templates/font-save.ts`)                                                                                                                                                        |
| The lab font test                                                | `src/ui/components/templates/` (`FontSwitcher.tsx`, `useFontTest.ts`, `font-test.ts`, `font-test.css`, `lab-font-list.ts`, `lab-fonts.css`)                                                                                                                                                                        |
| Tests                                                            | `tests/ui/theme-fonts.test.tsx`, `tests/ui/font-test.test.tsx`, `tests/ui/body-digits-font.test.ts`, `tests/ui/font-guards.test.ts` (themes use only the role utilities; the lab font list, stylesheet and files stay in step; variables, Tailwind and the CSS defaults agree), `tests/tools/fonts-record.test.ts` |

Back to the [lab README](./README.md).
