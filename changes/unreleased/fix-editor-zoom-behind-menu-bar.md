---
type: Fixed
---

- **Fix (UI): Card Editor hover-zoom no longer clips behind the top menu bar**
  - The editor workspace now sits above the header in the stacking order and no longer uses `overflow-hidden`, so a zoomed card can overlap the header instead of being cut off or painted under it.
