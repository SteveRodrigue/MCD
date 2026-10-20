# [ADR-0013] Game Settings & Developer Mode State Architecture

* **Status:** Accepted
* **Date:** 2026-08-27
* **Authors:** MCD Core Team
* **Deciders:** Core Architecture Team
* **Consulted:** UX Guidelines, Rules Authority (RR v1.8 Hidden vs Open Information)
* **Informed:** MCD Frontend Developers

---

## Context and Problem Statement

During development, testing, and debugging, developers and QA need the ability to inspect hidden draw decks (Player Draw Deck and Encounter Draw Deck) to verify shuffle order, obligation card insertions, and deck composition.

However, according to the official Marvel Champions rules (RR v1.8), draw decks are face-down hidden information in a real game unless an explicit card or rule allows searching/scrying.

We need a clean, persistent UI settings system that supports developer tooling (Dev Mode) and user options without contaminating the core game engine state or violating rules authority.

---

## Considered Options

> [!NOTE]
> This section was not part of the original decision record and is not required for this ADR.

---

## Decision Drivers

* **Separation of Engine vs UI Settings:** Client UI preferences (Dev Mode toggle, sound effects, animations speed) must not pollute the deterministic `GameState` tree.
* **Persistent Preferences:** UI settings should persist in local storage across browser reloads.
* **Rules Integrity:** When Dev Mode is disabled, face-down draw decks cannot be inspected, enforcing standard rules of hidden information.
* **Immediate Visibility:** Dev Mode status must be clearly and visibly indicated in the top menu bar.

---

## Decision Outcome

1. **`GameSettingsContext` State Store:**
   * React context providing `devMode` (boolean, default: `true` for development) and persistence in `localStorage`.
2. **Options Menu Modal (`OptionsMenu.tsx`):**
   * Accessible via a dedicated `⚙️ OPTIONS` button in the top navigation bar.
   * Provides controls for Dev Mode and future UI parameters (sound, animation, accessibility).
3. **Top Bar Visual Indicator (`TopBar.tsx`):**
   * Prominently displays `🛠️ DEV MODE: ON` with dynamic styling, allowing 1-click quick toggling directly from the menu bar.
4. **Conditional Deck Inspection:**
   * `VillainZone.tsx` and `PlayerHandTray.tsx` consume `useGameSettings()`. Deck inspection modals are gated by `devMode`. Discard piles and set-aside nemesis cards remain accessible as open information.

---

## Evaluation of Options

> [!NOTE]
> This section was not part of the original decision record and is not required for this ADR.

---

## Consequences & Tradeoffs

### Positive:
* Clean architecture separating client UI preferences from pure game rules.
* Instant visual feedback for testers and developers.
* Flexible foundation for all future game parameters (audio, keybindings, accessibility).

---

## Addendum (2026-10-19): Two engine behaviour flags in `state.options`

`autoResolveUnambiguous` and `villainPhaseStepping` are copied from the settings into `state.options` before every dispatch (`App.tsx`, `withUiOptions`). They are not display preferences: the first decides whether a one-option prompt opens, the second decides where the villain phase stops, so both change the action sequence. The engine reads them from the state, which keeps it a pure `(state, action)` reducer.

Passing them as a per-dispatch argument instead is tracked in [#337](https://github.com/SteveRodrigue/MCD/issues/337).
