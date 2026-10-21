# [ADR-0089] Structural Sharing for State Updates (Immer)

- **Status:** Accepted
- **Date:** 2026-10-20
- **Authors:** MCD Core Team
- **Deciders:** Owner & Claude
- **Related Issues:** Code audit AUD-20261017-232534, item R12 (F005 option C, F012 option B); supersedes the clone step of ADR-0076 decision 5; follows ADR-0081, ADR-0087

---

## Context and Problem Statement

Every action started with `cloneGameState` (a JSON-style deep copy), and the villain phase and clean-up cloned again. A clone gave every object a new identity: after one action 2 of 1,600 objects kept theirs, so `React.memo` and selectors could not skip anything and the whole board re-rendered per action (83–137 components per commit). One action copied 35–106 KB.

## Considered Options

1. **Immer `produce` around the action (chosen).**
2. `CardInstance.cardCode` plus a catalog lookup (F005-B): smaller saves, but no stable identity and the largest migration.
3. Keep cloning.

## Decision Outcome

**Chosen option 1.**

- `updateGameState(state, recipe)` (`models/state.ts`) is the one way to produce a next state. Branches the recipe leaves alone keep their identity; the previous state is never changed. Called with a draft already, it edits that draft in place, so nested phase runners need no second copy.
- `dispatchAction` runs the handler, the sequence and phase resumption, and the deck-exhaustion check inside one `updateGameState`. A rejected action throws internally and returns the previous state object.
- The villain phase runners, `initiatePlayerPhaseCleanup` and `runMatch` use it; `cloneGameState`, its JSON-semantics copy and the shared-definition registry are deleted. Catalog card definitions are instances of a marker class (`asCatalogCard`), which Immer neither drafts nor freezes, so a state update shares them and `.card` reads create no proxies (without the marker the 100-game simulation was 43 % slower, with it 20 %).
- **Legacy pointers:** removed in #215; the active villain and main scheme are read and written through `getActiveVillain` / `getActiveMainScheme`.
- Immer auto-freeze stays on, including in tests: writing to a state returned by the engine throws.
- UI: `CardView`, `FormattedCardText`, `CardArtThumbnail`, `CardAttachmentFan` and the hand tray's cards are memoised, the settings context value is memoised, and hand cards get a stable click handler.

## Consequences

- A state returned by the engine is frozen. Code and tests that need a changed copy call `updateGameState` instead of mutating (`tests/engine/update-game-state.test.ts`).
- States no longer have JSON semantics: functions and `undefined` properties stay (the clone dropped them).
- States returned by the engine are frozen, and so are the parts of the input state an update shares with its result. A test that arranges a state by writing to it calls `thaw` (`tests/support/thaw-state.ts`, a mutable copy) or `updateGameState`; 38 test files changed.
- Measured (`rhino`, 2 heroes, `END_PLAYER_TURN` with the villain phase): 99 % of objects keep their identity (was 2 of about 1,600), and the action takes 0.1 ms (a clone alone took 0.2 ms). The 100-game simulation gives identical results and takes 1.9 s (was 1.6 s): proxies cost more than the clone saved on the engine side. Game state outside the board components (zones read the whole session) still re-renders per action; per-slice selectors are a separate step (A3) if that proves too costly.
