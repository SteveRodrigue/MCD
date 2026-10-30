---
type: Added
---

- **Test (Engine): Masters of Evil modular set integration, interaction tests, and simulation verification ([Issue #501](https://github.com/SteveRodrigue/MCD/issues/501), [Issue #353](https://github.com/SteveRodrigue/MCD/issues/353))**
  - Adds comprehensive Rhino + Masters of Evil modular integration test suite in `tests/engine/masters-of-evil.test.ts`.
  - Verifies modular set deck composition (7 cards: 1x 01128, 1x 01129, 1x 01130, 1x 01131, 1x 01132, 2x 01133) and Bomb Scare exclusion.
  - Verifies The Masters of Evil (01128) side scheme discard-search engaging minion with first player.
  - Verifies cross-card activations under Masters of Mayhem (01133): Melter (01132) ally defense restriction, Tiger Shark (01131) Tough gain, Radioactive Man (01129) random hand discard, and Whirlwind (01130) multi-hero attack.
  - Verifies all 4 minion boost effects during combat resolution and headless multi-round match execution to completion.
  - Cleans up stale comments in `tests/data/card-loader.test.ts` and confirms 100% ability coverage across simulation.
