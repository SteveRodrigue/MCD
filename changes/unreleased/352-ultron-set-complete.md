---
type: Fixed
---

- **Fix (Engine, Data): The Ultron set is complete ([Issue #352](https://github.com/SteveRodrigue/MCD/issues/352))**
  - New card data: Countdown to Oblivion 3B, Program Transmitter, Rage of Ultron, Invasive AI and Ultron III's When Revealed. The `ultron` set is now scanned, so every card in it must keep an entry.
  - New CONSTANT effect `THREAT_CANNOT_BE_REMOVED`: threat cannot be removed from that main scheme by any source.
  - New trigger `VILLAIN_SCHEMED`: "After [villain] schemes".
  - `VILLAIN_SCHEMES` and enemy attack steps now return the threat placed or the damage dealt as their result, so a later `DISCARD` can use `count: { from: "PREVIOUS_RESULT" }`. A `DISCARD` count of 0 now discards nothing.
