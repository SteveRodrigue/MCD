---
type: Fixed
---

- **Fix (UI): Show exhausted tableau cards tilted, such as The Golden City, instead of only grayed out ([Issue #453](https://github.com/SteveRodrigue/MCD/issues/453))**
  - Remove the `isExhausted = false` default in `CardView.tsx` that made `instance.exhausted` unreadable since #388; the card now falls back to its instance state when no explicit prop is passed.
  - Exhausted (tilt and tag) and no action available (gray) stay independent: an exhausted card with another usable action is tilted but not gray.
