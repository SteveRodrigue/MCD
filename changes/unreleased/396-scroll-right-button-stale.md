---
type: Fixed
---

- **Fix (UI): The hero track's Scroll Right button no longer stays on screen when the track fits (Fixes #396)**
  - The track checked whether it could scroll only on mount, on scroll and on window resize. When its content shrank by itself (images loading, a seat changing width), the button stayed.
  - The track and its row of seats are now observed for size changes, so both jump buttons follow the real overflow.
