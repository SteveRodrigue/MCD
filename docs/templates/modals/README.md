# MCD Modal Templates & Style Lab

Reference for the themes of _Marvel Champions Digital_ and for every game prompt, decision dialog and utility modal.
The whole player-facing game follows the selected theme (see [ADR-0091](../../decisions/0091-themeable-modal-system.md));
the only look that never changes is the Bangers "MARVEL CHAMPIONS" banner on the first screen. The card editor
(`/editor`) is a developer tool outside the themes.

**Browse it:** run the dev server (`localhost:3000`) and open `/templates/`. The lab exists only on the dev server: production builds do not contain it or its fonts. The controls are a column on the left: **Style**, **Kit** and **Prompts** are each a cycling choice (previous, a list, next), like the fonts, with keys **T**, **K** and **P** (Shift goes back; the style cycle passes through the gallery). The first stop of the Style list is the overview of all styles (no buttons, readable text under each preview). Below them: the demo switches (verb colour, forced, card accent, reset) and the font test. **Back to game** is pinned at the very bottom so it is not clicked by mistake, and the column can be hidden with the arrow at its top. Modals open to its right, so the column is never covered.
Direct links look like `/templates/<style>/<modal>`, e.g. `/templates/splash/sequence`.

**Scope:** the lab is the design reference. It previews the real game modals and screens; the game never imports from it.

## Three axes

| Axis            | What it is                                                              | Where                                                    |
| --------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| **Style**       | How the modal is drawn (frame, header, texture, buttons, comic flavour) | `modal-styles.ts`                                        |
| **Modal type**  | What the modal does: Decision, Sequence (Wakanda Forever), Select       | `DecisionTemplate`, `SequenceTemplate`, `SelectTemplate` |
| **Verb colour** | Gameplay meaning of the header colour, identical in every style         | `VERB_MEANING` in `modal-styles.ts`                      |

Verb colours: yellow = decide, red = attack / forced, blue = thwart / info, purple = hero special,
green = defend / heal.

## Styles

| Style                            | One-liner                                          |
| -------------------------------- | -------------------------------------------------- |
| `pop-art` Pop-Art Action-Coded   | Lichtenstein dots, bold colour bars, 4px black ink |
| `storyboard` Storyboard Panels   | Tilted caption box, framed panels                  |
| `newsprint` Golden Age Newsprint | Aged paper, ink-black print, masthead header       |
| `night` Night Edition            | Dark ink, neon rule and glow                       |
| `splash` Splash Page             | Torn-edge banner, speed lines, big stickers        |
| `dossier` S.H.I.E.L.D. Dossier   | Manila folder, typewriter text, rubber stamp, tape |
| `hud` Hero HUD                   | Holographic scanlines, cyan glow, readouts         |

Token reference and how to add a style: [styles.md](./styles.md).

## Comic and super-hero flavour (built in)

Every style carries its own version of these, driven by tokens, so the feel stays consistent:

- **Sound-effect bursts** when the player acts (POW!, KA-POW!, APPROVED, TARGET LOCKED...). Respects reduced motion.
- **Narrator captions** ("Meanwhile, at the docks...") above the body.
- **Speech bubbles** spoken by a card (the villain taunts, a hero asks for backup), thumbnail beside the bubble.
- **Finisher tag** pinned on the last slot of a sequence (starburst, FINAL EDITION, PRIORITY, OVERRIDE...).
- **Lab-only extras**: a faux game board behind the modal so the dimmed backdrop is judged in context.

## Mandatory rule: Card Anchoring

A card thumbnail (`CardArtThumbnail` `xs`/`sm`/`lg`) or the full `CardView` **MUST** be shown whenever a card is:

1. **Named** (header, prompt description, option buttons, recap checklists, footer);
2. **Its text is shown** (rules or ability text sits next to the source card's thumbnail);
3. **Its ability is used** (option, step, payment, target using an ability);
4. **The trigger** that opened the modal.

**Never display a card reference solely as plain text.** Enforced by construction and by test:

- Write card names only with `CardRef` (thumbnail + name). No bare card-name strings in modal JSX.
- `ModalScaffold` requires a `trigger` card (`null` only when no card is involved) and shows it in the header.
- `tests/ui/modal-templates.test.tsx` scans the rendered DOM of every style x modal type and fails on any
  card name outside a `CardRef` / `CardView`.

## Mandatory rule: say it once

Within a modal, each fact is written once: the question is the dialog title (no second title in the body), a card shown in the body is not also the header trigger, a value ("2 ATK") appears in one place, a verb is not repeated on every row, and a kicker is dropped when it only restates the title. `tests/ui/modal-repetition.test.tsx` and `tests/ui/decision-modal-repetition.test.tsx` hold the rule for the modals that had broken it.

## Modal types

1. **Decision**: forced or optional prompt. Trigger card in the header, threat showcase, one option row per choice, each with its card thumbnail.
2. **Sequence** (Issue #358): reorder real card faces with Left/Right buttons below each card (clear of hover-zoom), drag-and-drop, step badges, finisher tag.
3. **Select**: pick N of M cards from a grid with a live counter; confirm only for a valid count.

The **Modals** kit also previews every other real game modal, in three groups (`ModalPreviews.tsx` feeds each one sample data; `lab-state.ts` builds a real Rhino game for the ones that read the game session):

- **Prompts**: Distribute, Order (simultaneous abilities), Payment, Boost (combat summary).
- **Targets and menus**: Attack target, Thwart target, Identity menu, Ally menu, Tableau menu.
- **Dialogs**: Pile viewer, Options (its settings live in the lab only), Report, Card stats, Reset stats, Game over, Infinite loop.

Callbacks only report to the lab's status chip; no preview changes a game.

## Files

Shared theme code (used by the game and the lab), `src/ui/theme/`:
`modal-styles.ts` (tokens), `ModalScaffold.tsx` (the one shell; supports `onClose`, `closeOnBackdrop`, `layer`),
`ModalStyleContext.tsx` + `useModalStyle.ts` (active style), `ThemeProvider.tsx` + `useGameTheme.ts`
(player setting, per-game Random roll), `resolve-theme.ts`, `theme-settings.ts`, `card-accents.ts`, `CardRef.tsx`,
`AccentStripe.tsx`, `ComicSpeech.tsx`, `ActionBurst.tsx` + `useActionBurst.ts`, `comic-shapes.ts`,
`ThemePicker.tsx` (the player's choice, in Options and on the setup screen), `ThemePreview.tsx` (token-drawn mini modal
shared by the picker and the lab gallery), `GameThemeRoot.tsx` + `game-stage.ts` (the table and font roles of the setup,
mulligan and game screens), `theme-extras.ts` + `useThemeExtras.ts` (table, danger button, form field and newspaper tokens),
`useNewspaperProps.ts` and the kit components in `kit/`. The modal layer (`src/ui/components/layout/ModalLayer.tsx`) sets the
theme's font roles for everything rendered in its portal.

Migrated game modals (render through `ModalScaffold`), in `src/ui/components/board/`: `WakandaForeverModal`,
`DecisionPromptModal` (with `PromptCardPanel`), `SelectCardsModal`, `AttackTargetModal` and `ThwartTargetModal`
(both on `TargetSelectionModal`), `AllyActionModal`, `TableauActionModal` and `IdentityActionModal` (on
`CardActionModal`), `CombatBoostModal`, `DistributeAmountModal`, `SimultaneousAbilitiesModal`, `CardPaymentModal`.
Utility dialogs on the scaffold: `OptionsMenu`, `ReportProblemModal`, `CardStatsModal`,
`ResetCardStatsConfirmModal`, `GameOverScreen`, `InfiniteLoopModal` (in `App.tsx`), and the pile viewers (deck inspectors,
discard piles, removed from game, set aside, dealt-cards peek) in `VillainZone`, `PlayerHandTray`,
`RemovedFromGameBox` and `FacedownEncounterCard`, all on `PileViewerModal` (`PileCardTile`, `PileGroup`, `PileToolbar`).
Board chrome and screens on the theme's tokens and the kit (`src/ui/theme/kit/`): `QuickMenu` and `SideDock` (the rail above the combat log), `ExtraActionsPill`, `DevStepErrorBanner`, the villain
and hero zones, the hand tray, the out-of-play box, the villain phase stepper, the damage splash, the card context menu,
`ScenarioSelector` and `MulliganScreen` (except the Bangers banner), and the table behind them (`GameThemeRoot`).
`DailyBugleActionNewspaper`, `EndTurnConfirmationModal` and the `CombatLogPanel` are Newspaper kit pages (`NewspaperSheet`):
each theme draws its own era of newspaper. The theme guards (`tests/ui/theme-guards.test.ts`) keep literal comic looks out of these files.
Shared pieces: `ActionRow` (one choice in an action list), `CardActionModal` + `InfoStrip` (the card action menu
shell), `TargetSelectionModal` (pick-a-card-to-act-on).

Lab and reference (kept for future design), `src/ui/components/templates/`: the three templates
(`DecisionTemplate`, `SequenceTemplate`, `SelectTemplate`) are **harnesses**: each renders the real game modal with a
sample prompt (`template-data.ts`) and lays the comic flavour over it through `ModalFlavorContext`
(`useModalFlavor.ts`: narration or speech bubble above the body, sound-effect burst). What you see at `/templates/` is
what the game renders. Also `template-routes.ts`, `StyleGallery.tsx`, `ModalTemplatesScreen.tsx`. The lab sets a
`verbOverride` on the style context for its verb switch; the game never does.

The game never imports from the lab folder; an architecture test enforces it.

## Kits

Beyond modals, the lab previews the rest of the look, built from the same primitives the game uses, so a theme can be judged as a whole. Open the **Kit** bar at `/templates/<style>/<item>`:

- **Elements** (`elements`): button family (primary, secondary, danger, ghost, icon), badges, ribbons, stat counters, gauges, switch, text field, select, menu, toast, damage splash, type roles.
- **Board** (`board`): side dock (quick-menu rail above the combat log, with the attention beacon on the Daily Bugle button), villain zone, main scheme, hero zone with the hero colour as an accent, hand tray, context menu, toast, splash, on the theme's table background.
- **Newspaper** (`newspaper`): the Daily Bugle in this theme's era (action sheet, end-turn broadsheet, combat log wire with filter, EXTRA! shortcut). The era changes per theme, from a 1960s broadsheet to a holographic feed; the newspaper identity (masthead, edition line, stories, flash, ticker) never does. **The action sheet always keeps the game's three columns, in every theme**: column 1 the front page (identity directives, playable hand cards), column 2 the classifieds (in-play assets and allies, villain dispatches), column 3 the Call for Action! column (teammate tableau assets, grouped by teammate), with the turn-flow bar at the bottom. The grid collapses to two or one columns only when a column is empty, as in the game, and stacks on a narrow screen. `NewspaperColumns` draws it.
- **Setup** (`setup`): scenario spread and mulligan.

Kit code: tokens in `src/ui/theme/theme-extras.ts` (table, type roles, danger button, form field, `newspaper` group) read with `useThemeExtras`; primitives in `src/ui/theme/kit/` (`controls.tsx`, `meters.tsx`, `surfaces.tsx`, `newspaper.tsx`); pages in `src/ui/components/templates/kits/`.
Card display follows one rule: thumbnails (`CardRef`) in modals, the Daily Bugle and the combat log; full `CardView` cards on the board, in hands and in setup (the Board and Setup kits). The kit pages show the primitives with sample data; the game screens are built from the same primitives and tokens.

## Theme fonts

A theme sets its fonts in the `fonts` token (`modal-styles.ts`, `ThemeFonts`): a required **Headlines + Body** pair, an optional **Newspaper** pair that overrides it for the Daily Bugle, and an optional **Numbers & codes** font. `font-comic` (headlines), `font-body` and `font-mono` (numbers and codes) read the CSS variables `--font-comic`, `--font-body` and `--font-numbers` (defaults in `src/ui/styles/index.css`); `themeFontVars` sets them on the game root (`GameThemeRoot`), the modal layer (`ModalLayer`), the card context menu, the modal overlay, the theme preview and the lab's table. **Pop-Art uses Lilita One** for headlines and body, **Storyboard Panels uses Kalam**, **Splash Page uses Boogaloo**, **Golden Age Newsprint uses Merriweather**, **Night Edition uses JetBrains Mono**, **Hero HUD uses Lexend** and **S.H.I.E.L.D. Dossier uses Special Elite**, all bundled with `@fontsource`. There is no separate Serif slot: the serif typeface only served the Daily Bugle, so it is the Newspaper pair.

The full record of which fonts each theme uses, which can be set (and which cannot yet) is [FONT_RECORD.md](./FONT_RECORD.md). A theme has a default **Headlines + Body** pair and the Newspaper can override either of them.

## Font test (lab only)

The lab bar has a **Font test** row to check how text reads on screen, with **two separate lists**: one font for **headlines** and one for **body** text. Each list starts with "Theme font (default)", so you can change one and keep the other. Press **F** to move both to the next font, **H** for the headlines alone, **B** for the body alone, and add **Shift** to go back (the cycle passes through the theme font). A second row, **Newspaper**, has its own Headlines and Body lists ("Follow default" when unset); inside a newspaper they win over the default pair, and **N** cycles both. The _Theme fonts_ button resets all four. The lab bundles its test fonts (Bangers, the original headline font, is the first so you can compare it with the new theme fonts): sans (Atkinson Hyperlegible, Lexend, Inter, Open Sans, Roboto, Source Sans 3, IBM Plex Sans, Fira Sans, Work Sans, Lato, Poppins), rounded (Nunito, Fredoka, Baloo 2), comic and handwriting (Comic Neue, Patrick Hand, Kalam), serif (Merriweather, Literata), mono (JetBrains Mono), comic display for headlines (Bangers, Lilita One, Luckiest Guy, Boogaloo, Passion One, Titan One, Sigmar One, Bowlby One, Bungee: readable stand-ins for Bangers) and typewriter (Special Elite, Courier Prime, Cutive Mono, Xanh Mono, Anonymous Pro: for the S.H.I.E.L.D. Dossier). A _headline_ is a heading or text of 17px or more (`text-base` and up); _body_ is anything smaller. The lab tags each piece of text with `data-font-role` while a font is on, so the roles follow what the text is, not which font utility it uses.

The themes keep their own fonts ("Theme fonts (default)" is each theme's own, Kalam for Storyboard, Merriweather for Golden Age Newsprint, JetBrains Mono for Night Edition, Lexend for Hero HUD, Special Elite for the Dossier, Boogaloo for Splash Page, Lilita One for Pop-Art headlines): the choice is an override written on `<html>` while the lab is open (`font-test.css`), it applies to modals too, it skips the lab bar, and it is removed when the lab closes. It is remembered between visits. Files: `font-test.ts`, `useFontTest.ts`, `FontSwitcher.tsx`, `lab-font-list.ts`, `lab-fonts.css` and `fonts/*.woff2` (Google Fonts, latin subset, SIL Open Font License or Apache 2.0).

## Plans

- [Style lab plan](./PLAN_style_lab.md): how the lab and its seven styles were built.
- [Theme engine plan](./PLAN_theme_engine.md): the phased rollout of player-selectable and random themes in the game.
- [Fonts plan](./PLAN_fonts.md): slots, roles, record and guards for the theme fonts, with the readability review.
- [Game integration plan](./PLAN_game_integration.md): bringing the fonts and sizes into the game (N1 to N9); the player font choice (N7) is open.
- [Board theming plan](./PLAN_board_theming.md): the board, setup, table, combat log and Daily Bugle follow the theme (N4).
- [Audit of the unthemed UI](./AUDIT_unthemed_ui.md): what the theme engine did not cover before the board work, with the decisions that were applied.
