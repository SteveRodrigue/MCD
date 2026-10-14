---
type: Fixed
---

- **Fix (UI): In-flow sticky top bar layout on smaller screens ([Issue #301](https://github.com/SteveRodrigue/MCD/issues/301))**
  - Replaced out-of-flow fixed positioning in `TopBar.tsx` with in-flow sticky positioning (`sticky top-0 w-full z-40`).
  - Removed hardcoded offset padding (`pt-20 md:pt-24`) from `<main>` in `GameBoard.tsx`, ensuring tabletop content always flows naturally below the header without being obscured when the top bar wraps into multiple lines.
  - Added responsive labeling for the round phase badge and multi-hero seat selectors to reduce unnecessary wrapping on compact viewports.
