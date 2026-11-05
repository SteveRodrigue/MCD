---
type: Fixed
---

- **Fix (Content): Art packs no longer disappear after `npm run assets:pull`**
  - The content index, the Node content driver, pack discovery and `pack-validate` now follow symbolic links and Windows junctions, with protection against link loops.
  - `npm run assets:pull -- --copy` now replaces an existing link with a real copy instead of leaving it in place.
