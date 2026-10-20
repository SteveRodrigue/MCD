---
type: Fixed
---

- **Fix (Data/Engine): Reveal The "Immortal" Klaw when Klaw II is revealed, including at setup ([Refs #265, AUD-20261017-232534 R9](https://github.com/SteveRodrigue/MCD/issues/265))**
  - Added declarative When Revealed ability for Klaw II (01114) searching and revealing The "Immortal" Klaw (01127).
  - Modeled The "Immortal" Klaw as a side scheme granting a continuous +10 hit points modifier to the villain while in play.
  - Implemented dynamic villain max health calculation and synchronization, and removed legacy procedural stage II reveal methods from Klaw scenario plugin.

