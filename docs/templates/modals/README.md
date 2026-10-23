# MCD Modal Templates & Style Lab

Reference for every game prompt, decision dialog and utility modal in *Marvel Champions Digital*.
Once a style is settled, these templates are what the real modals get retrofitted to (see
[ADR-0056](../../decisions/0056-unified-comic-pop-art-modal-and-dialog-design-system.md)).

**Browse it:** run the dev server (`localhost:3000`) and open `/templates/`.
Direct links look like `/templates/<style>/<modal>`, e.g. `/templates/splash/sequence`.

**Scope for now:** the lab only. No engine, data or real-modal changes until a style is chosen.

## Three axes

| Axis | What it is | Where |
|---|---|---|
| **Style** | How the modal is drawn (frame, header, texture, buttons, comic flavour) | `modal-styles.ts` |
| **Modal type** | What the modal does: Decision, Sequence (Wakanda Forever), Select | `DecisionTemplate`, `SequenceTemplate`, `SelectTemplate` |
| **Verb colour** | Gameplay meaning of the header colour, identical in every style | `VERB_MEANING` in `modal-styles.ts` |

Verb colours: yellow = decide, red = attack / forced, blue = thwart / info, purple = hero special,
green = defend / heal.

## Styles

| Style | One-liner |
|---|---|
| `pop-art` Pop-Art Action-Coded | Lichtenstein dots, bold colour bars, 4px black ink |
| `storyboard` Storyboard Panels | Tilted caption box, framed panels |
| `newsprint` Golden Age Newsprint | Aged paper, ink-black print, masthead header |
| `night` Night Edition | Dark ink, neon rule and glow |
| `splash` Splash Page | Torn-edge banner, speed lines, big stickers |
| `dossier` S.H.I.E.L.D. Dossier | Manila folder, typewriter text, rubber stamp, tape |
| `hud` Hero HUD | Holographic scanlines, cyan glow, readouts |

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

## Modal types

1. **Decision**: forced or optional prompt. Trigger card in the header, threat showcase, one option row per choice, each with its card thumbnail.
2. **Sequence** (Issue #358): reorder real card faces with Left/Right buttons below each card (clear of hover-zoom), drag-and-drop, step badges, finisher tag, text recap with thumbnails.
3. **Select**: pick N of M cards from a grid with a live counter; confirm only for a valid count.

## Files

Shared theme code (used by the game and the lab), `src/ui/theme/`:
`modal-styles.ts` (tokens), `ModalScaffold.tsx` (the one shell; supports `onClose`, `closeOnBackdrop`, `layer`),
`ModalStyleContext.tsx` + `useModalStyle.ts` (active style), `ThemeProvider.tsx` + `useGameTheme.ts`
(player setting, per-game Random roll), `resolve-theme.ts`, `theme-settings.ts`, `card-accents.ts`, `CardRef.tsx`,
`AccentStripe.tsx`, `ComicSpeech.tsx`, `ActionBurst.tsx` + `useActionBurst.ts`, `comic-shapes.ts`,
`ThemePicker.tsx` (the player's choice, in Options and on the setup screen) and `ThemePreview.tsx` (token-drawn mini modal
shared by the picker and the lab gallery).

Migrated game modals (render through `ModalScaffold`), in `src/ui/components/board/`: `WakandaForeverModal`,
`DecisionPromptModal` (with `PromptCardPanel`), `SelectCardsModal`, `AttackTargetModal` and `ThwartTargetModal`
(both on `TargetSelectionModal`), `AllyActionModal`, `TableauActionModal` and `IdentityActionModal` (on
`CardActionModal`), `CombatBoostModal`, `DistributeAmountModal`, `SimultaneousAbilitiesModal`, `CardPaymentModal`.
Utility dialogs on the scaffold: `OptionsMenu`, `ReportProblemModal`, `CardStatsModal`,
`ResetCardStatsConfirmModal`, `GameOverScreen`, `InfiniteLoopModal` (in `App.tsx`), and the pile viewers (deck inspectors,
discard piles, removed from game, set aside, dealt-cards peek) in `VillainZone`, `PlayerHandTray`,
`RemovedFromGameBox` and `FacedownEncounterCard`, all on `PileViewerModal` (`PileCardTile`, `PileGroup`, `PileToolbar`).
Exempt (ADR-0056 tier 2): `DailyBugleActionNewspaper`, `EndTurnConfirmationModal`. Not modals: `CombatLogDrawer`,
`DevStepErrorBanner`.
Shared pieces: `ActionRow` (one choice in an action list), `CardActionModal` + `InfoStrip` (the card action menu
shell), `TargetSelectionModal` (pick-a-card-to-act-on).

Lab and reference (kept for future design), `src/ui/components/templates/`: the three templates
(`DecisionTemplate`, `SequenceTemplate`, `SelectTemplate`) are **harnesses**: each renders the real game modal with a
sample prompt (`template-data.ts`) and lays the comic flavour over it through `ModalFlavorContext`
(`useModalFlavor.ts`: narration or speech bubble above the body, sound-effect burst). What you see at `/templates/` is
what the game renders. Also `template-routes.ts`, `StyleGallery.tsx`, `ModalTemplatesScreen.tsx`. The lab sets a
`verbOverride` on the style context for its verb switch; the game never does.

The game never imports from the lab folder; an architecture test enforces it.

## Plans

- [Style lab plan](./PLAN_style_lab.md): how the lab and its seven styles were built.
- [Theme engine plan](./PLAN_theme_engine.md): the phased rollout of player-selectable and random themes in the game.
