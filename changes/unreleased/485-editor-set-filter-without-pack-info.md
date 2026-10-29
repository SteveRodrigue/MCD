---
type: Fixed
---

- **Fix (UI): Card Editor set dropdown no longer empties when pack metadata lacks pack info (Follow-up to #478)**
  - `CardFilterToolbar` shows every set when none of them carry `pack_code` / `pack_codes`, instead of filtering them all out after a pack such as Core Set is selected.
