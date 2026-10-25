# [ADR-0091] Themeable Modal System (Theme Engine)

- **Status:** Accepted
- **Date:** 2026-10-22
- **Authors:** MCD Core Team
- **Deciders:** User & Claude

---

## Context and Problem Statement

[ADR-0056](0056-unified-comic-pop-art-modal-and-dialog-design-system.md) gave every modal one Comic Pop-Art
look, but each modal still wrote its own frame, header and button markup. The styling drifted again, some utilities
silently did nothing (`border-3` is not in our Tailwind config), and mock card boxes stood in for real cards. The
player also had no way to choose how the game looks.

We want one coherent game, several complete looks to choose from, and a way for the player to pick a look or let
the game pick a random one for each new game.

---

## Decision Drivers

- **Coherence:** every modal, in every look, reads the same way (same verb colours, same card thumbnails).
- **One place to change a look:** adding or tuning a theme must not touch the modals.
- **Player choice:** a chosen theme, or Random per game.
- **Rules clarity:** gameplay meaning never depends on the theme.
- **Determinism:** UI choice must not touch engine randomness or game replays.
- **Lean change:** no parallel systems; the in-universe newspapers keep their own identity (ADR-0056 tier 2).

---

## Considered Options

1. **Option 1: Keep one pop-art style** and fix drift by hand.
2. **Option 2: Theme engine (chosen):** a token registry of themes, one modal scaffold that reads the active theme,
   and a player setting with Random per game.
3. **Option 3: CSS variables only:** recolour the existing markup through variables.

---

## Decision Outcome

**Chosen Option:** **Option 2: Theme engine.**

- **Registry** (`src/ui/theme/modal-styles.ts`): one `ModalStyle` token object per theme (frame, header layout,
  texture, panels, option rows, buttons, comic flavour, card accent look). Seven themes ship: Pop-Art, Storyboard,
  Newsprint, Night Edition, Splash Page, S.H.I.E.L.D. Dossier, Hero HUD. Adding one is one object.
- **One shell** (`ModalScaffold`): backdrop, frame, header, body, footer, dismissal (close button, Escape, optional
  backdrop click), stacking layer, focus handling. Every game modal renders through it.
- **Verb colours are fixed across themes:** yellow decide, red attack or forced, blue thwart or info, purple hero
  special, green defend or heal.
- **Card Anchoring Rule:** whenever a card is named, its text shown, its ability used, or it triggered the modal, its
  thumbnail (or card face) is shown. `CardRef` is the way to write a card name; a test scans every theme.
- **Card accents:** an optional coloured edge on card-bearing elements (hero colours from the upstream pack, aspect
  colours, villain and encounter fallbacks), drawn the way each theme draws it.
- **Player setting** (`themeMode`, `themeId`, `randomThemePool`, `cardAccents` in the existing game settings):
  fixed theme, or Random. Random rolls once when a game starts, never repeats the previous game's theme, and survives
  a reload. The roll uses the UI's random source, never the engine RNG.
- **Tier 2 follows the theme as Newspaper kit pages:** the Daily Bugle action sheet, the end-turn flash and the combat log panel are `NewspaperSheet` pages (`src/ui/theme/kit/newspaper.tsx`). Each theme draws its own era of newspaper (`newspaper` tokens in `theme-extras.ts`); the newspaper identity (masthead, edition line, stories, flash, ticker) and the three-column action sheet never change.
- **Template lab:** `/templates/` renders the real game modals with sample prompts for every theme, and stays as the
  design reference (`src/ui/components/templates/`, `docs/templates/modals/`). The game never imports from it.

### Rationale ("The Why")

Themes become data, so the modals stop owning style decisions and the drift cannot return. The scaffold gives every
modal the same dismissal and accessibility behaviour. Keeping verb colours and thumbnails fixed means a player can
switch themes freely without losing any rules information.

---

## Evaluation of Options

### Option 1: Keep one pop-art style

- **Pros:** No new system.
- **Cons:** Drift returns; no player choice; the silent `border-3` class of defect stays.

### Option 2: Theme engine (chosen)

- **Pros:** One shell, one registry, a player-facing choice, a testable matrix (every theme x every modal).
- **Cons:** A theme is a set of Tailwind class strings (they must be written out, never built by interpolation); each
  new modal must use the scaffold and tokens.

### Option 3: CSS variables only

- **Pros:** Small.
- **Cons:** Cannot change structure (header layouts, shapes, textures), so the themes would only be recolours.

---

## Consequences

### Positive Consequences

- Seven complete looks, selectable or random per game, with one place to maintain each.
- Modal behaviour (dismissal, focus, layering) is uniform; tests run every modal under every theme.
- Card Anchoring Rule is enforced by construction and by test.

### Negative Consequences / Risks & Mitigations

- **A theme can hurt readability:** Pop-Art is the default; the player can switch at any time; contrast is checked per
  theme when a theme is added.
- **New modals can bypass the scaffold:** guidelines point to it, and the matrix test lists every migrated modal.
- **The whole player-facing UI follows the theme** (board, setup, table, newspapers), except the first-screen Bangers
  banner and the card editor, which is a developer tool. Guards keep it that way: `tests/ui/theme-guards.test.ts` keeps
  literal comic looks out of migrated files and `tests/ui/font-guards.test.ts` keeps the font roles.
