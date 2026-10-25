---
type: Fixed
---

- **Fix (UI): The hero track jump buttons move the view completely to the left or right end (Fixes #380)**
  - A click used to scroll only 400 px (half a seat), the buttons sat at the middle of the whole tall track (off screen unless the page was scrolled there), and the edge-scroll loop cancelled the smooth scroll while the pointer was over a button.
  - The buttons now go to the real end of the track, stay at the vertical middle of the screen (sticky), and opt out of edge scrolling.
  - Edge scrolling now measures the track's own edges instead of the window's, so the side dock no longer scrolls the board. The test file `edge-scroll.test.ts`, which only re-computed constants, is replaced by tests that drive the real hook.
