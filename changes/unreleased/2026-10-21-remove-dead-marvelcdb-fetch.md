---
type: Changed
---

- **UI: removed the dead MarvelCDB fetch from the card art cache**
  - `card-cache-service.ts` no longer contains the unused MarvelCDB fetch path (AUD-20261017-232534 R15 OQ-4); card art caching behaves as before.
