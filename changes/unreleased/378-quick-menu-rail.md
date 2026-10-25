---
type: Changed
---

- **Change (UI): The full-width top bar is replaced by a quick-menu rail above the combat log (Fixes #378)**
  - The board gains the ~52 px the bar took. The right column is now one always-docked `SideDock`: a slim rail (round, phase, Daily Bugle with its count, Options, and a `⋯` menu with Report a problem, Dev mode and New game) above the combat log. Desktop only; small screens and touch are not supported yet.
  - Removed: the Jump to Hero seat selector (the seat headers switch seats), the Combat Log toggle and the closable log drawer. The first-player token now shows as a badge in the seat header.
  - Call for Action and Villain actions are harder to miss: the EXTRA! pill and the Daily Bugle button of the rail show a soft expanding ring (no ring with reduced motion, and none once the Bugle is open). The old fading pulse is gone.
  - Removed the unused `sticky` z-layer. ADR-0082, ADR-0013, ADR-0017 and the coding guidelines are updated; the Template Lab Board kit draws the new dock.
