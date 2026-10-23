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
