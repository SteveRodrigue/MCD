---
type: Fixed
---

- **Fix (UI): Card hover zoom floats above modal panels**
  - Cards inside a modal body (such as the optional-decision prompt) were clipped by the scrolling panel when zoomed. The zoom now draws in a portal above the modal, so it is never clipped.
