---
type: Added
---

- **Feature (UI): Visible "Removed from Game" pile and inspector modal ([Issue #282](https://github.com/SteveRodrigue/MCD/issues/282))**
  - Created standalone `RemovedFromGameBox` comic panel component on the main tabletop stage outside `VillainZone`.
  - Added pop-art modal inspection viewer for out-of-play cards removed from the game.
  - Wired `gameState.removedFromGame` directly from `GameBoard.tsx`.
  - Arranged Encounter Discard and Draw piles horizontally in `VillainZone` (`[Discard] -> [Deck]`) to maintain a consistent left-to-right tabletop flow and avoid vertical sprawl.
  - Unified attachment rendering across Villain, Minions, Allies, and Side Schemes via shared `CardAttachmentFan` (defaulting to staircase mode) and `getStaircaseExpansion` helper in `attachment-fan-utils.ts`.
  - Ensured Villain SCH/ATK stats column and vertical HP meter remain `relative z-30` so they stay always on top of descending attachment fans, matching Hero identity presentation.
