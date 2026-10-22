---
type: Added
---

- **Feature (UI): Display defeated heroes in Out of Play ([Issue #357](https://github.com/SteveRodrigue/MCD/issues/357))**
  - Render each eliminated hero in `RemovedFromGameBox` as a grayscale stack with a "DEFEATED" ribbon; the stack wraps when up to three heroes have fallen.
  - Stack the eliminated hero's draw deck underneath with a compact facedown peek.
  - The inspection modal shows the whole play area that left the game (hand, deck, discard, upgrades and supports, allies, attachments, set-aside nemesis cards, cards underneath) with a count for every zone.
  - Every pile in the modal lists its top card first, so `#1` is the top (the removed pile and discard pile show the newest card first).

- **Fix (Engine): Nemesis cards are never player-owned on elimination ([Issue #357](https://github.com/SteveRodrigue/MCD/issues/357))**
  - A nemesis card in play stays with the encounter deck and discard instead of leaving with the eliminated player; set-aside nemesis cards leave with them (RR v1.8 Player Elimination).
