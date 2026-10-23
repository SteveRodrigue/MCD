---
type: Added
---

- **Feature (UI): Modal style lab at `/templates/` for choosing the game's modal theme**
  - Seven styles (Pop-Art, Storyboard, Newsprint, Night Edition, Splash Page, Dossier, Hero HUD) shown on three modal types (Decision, Sequence, Select), with a verb-colour switch and a card-accent toggle.
  - One modal scaffold, a style token registry, comic flavour (sound-effect bursts, narrator captions, speech bubbles, finisher tags) and a card accent layer that uses hero colours from the upstream pack.
  - Card Anchoring Rule: every card name, text, ability or trigger in a modal carries its thumbnail, enforced by a test.
- **Feature (UI): Theme engine foundation**
  - Shared theme code moved to `src/ui/theme/`; player theme settings (`themeMode`, `themeId`, `randomThemePool`, `cardAccents`) validated on load.
  - `ThemeProvider` supplies the active theme at the app root and rolls a Random theme once per new game (kept across reloads, never the same twice in a row).
  - `ModalScaffold` gains `onClose`, Escape, backdrop close, stacking layer and focus handling.
- **Feature (UI): Wakanda Forever, Decision and Select modals follow the active theme ([Issue #358](https://github.com/SteveRodrigue/MCD/issues/358))**
  - `WakandaForeverModal` shows the real card faces (trigger and every upgrade) with Left/Right move buttons below each card, a finisher tag and a recap with thumbnails.
  - `DecisionPromptModal` and `SelectCardsModal` render through the shared scaffold and theme tokens; card accents and thumbnails on every card they name.
  - The Wakanda Forever! prompt now carries its source card code so the header and card face can be shown.
  - The lab templates now render these real modals with sample prompts.
