---
type: Changed
---

- **UI: Refine "Call for Action" & "Villain Actions" with EXTRA! hover pill, dynamic broadsheet layout, and teammate grouping ([Issue #314](https://github.com/SteveRodrigue/MCD/issues/314))**
  - Moves action indicators from the TopBar into a floating 1960s newsboy-styled "EXTRA! [N]" hover button at top-left of the game board.
  - Dynamically adjusts Daily Bugle broadsheet columns and container width (`max-w-xl`, `max-w-4xl`, `max-w-6xl`) to prevent empty columns when in-play or encounter actions are absent.
  - Groups Call for Action items by teammate hero seat with clean header banners (e.g. `CAPTAIN MARVEL (Hero Seat 2)`).
  - Renders complete printed `card.text` formatted via `FormattedCardText` for teammate dispatches without line truncation.
