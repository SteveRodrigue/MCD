---
type: Changed
---

- **Performance (Engine, UI): State updates share unchanged branches (AUD-20261017-232534 R12, ADR-0089)**
  - `updateGameState` (Immer `produce`) replaces `cloneGameState` in the action dispatcher, the villain phase, player-phase clean-up and the simulator. After a full End Turn, 99 % of the state's objects keep their identity (was 2 of about 1,600). States the engine returns are frozen, so writing to one throws.
  - `CardView`, `FormattedCardText`, `CardArtThumbnail`, `CardAttachmentFan` and the hand tray's cards are memoised, the settings context value is memoised, and hand cards get a stable click handler. A test shows an action that only changes the villain does not re-render the hand cards.
  - Catalog card definitions are marked with `asCatalogCard` so Immer leaves them shared and unfrozen. The 100-game simulation gives identical results in 1.9 s (was 1.6 s).
  - Tests that arrange a state by writing to it use the new `thaw` helper (`tests/support/thaw-state.ts`) or `updateGameState`, because states the engine returns are frozen.
  - Removed: `cloneGameState`, the shared card-definition registry and the clone's JSON semantics (functions and `undefined` properties are no longer dropped).
