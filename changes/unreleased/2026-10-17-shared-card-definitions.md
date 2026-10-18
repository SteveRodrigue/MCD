---
type: Changed
---

- **Performance (Engine): State clones share card definitions (AUD-20261017-232534 F005)**
  - `cloneGameState` keeps the `JSON.parse(JSON.stringify())` behaviour (functions and `undefined` dropped) but returns catalog card definitions by reference; card definitions were 83–85 % of a fresh state's bytes. `createCardInstance` now keeps the catalog object instead of copying it, and a card without supplemental data gets one shared copy with an empty enrichment.
  - Clone time at setup fell from 1.79 ms to 0.33 ms (1 player) and from 2.74 ms to 0.16 ms (2 players); at the end of a long 2-player game from 3.64 ms to 1.09 ms. The 100-game simulation gate runs in 4.1 s instead of 14.3 s.
  - Tests run with the catalog deep-frozen, so any write to a shared definition throws. No source code wrote to one; 30 test writes now replace the card instead (`tests/support/card-overrides.ts`). Rule added to `docs/coding_guidelines.md`.
