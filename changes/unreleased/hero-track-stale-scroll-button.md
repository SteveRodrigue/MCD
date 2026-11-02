---
type: Fixed
---

- **Fix (UI): Hide the scroll-right button on the hero track when nothing overflows**
  - The track's scroll and resize listeners stayed bound to the first track element, so a rebuilt track left the jump button showing with nothing to scroll. They now follow the live element, and both buttons clear when the track leaves the page.
