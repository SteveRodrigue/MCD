---
type: Fixed
---

- **Fix (UI): A seat wider than the board column keeps its left edge in view (Fixes #382)**
  - Focusing a seat centers it in the hero track. A seat wider than the track (880 px against a column under about 900 px, for example a 1280 px window beside the side dock) overflowed on both sides and lost about 35 px of its left edge. It is now aligned to the left of the track, inside the padding; a narrower seat is still centered.
