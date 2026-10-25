---
type: Fixed
---

- **Fix (UI): The hero track no longer shows the browser's horizontal scrollbar (Fixes #384)**
  - The track used a `no-scrollbar` class that no stylesheet defined. It is now defined (`scrollbar-width: none` and the WebKit equivalent). The track still scrolls with its jump buttons, edge scrolling and the mouse wheel.
