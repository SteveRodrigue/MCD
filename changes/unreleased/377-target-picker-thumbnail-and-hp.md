---
type: Fixed
---

- **Fix (UI): Attack and thwart pickers show the villain and main scheme thumbnail, and the villain's real max HP (#377)**
  - The target builders pass a plain `code` instead of a half-built `cardInstance`, so the villain, main scheme and side schemes now get their thumbnail.
  - The villain row reads `villain.maxHealth` (14 per hero, plus HP modifiers), not the printed 14: `18 / 28` with two heroes.
  - The HP and threat line sits clear of the thumbnail's shadow.
