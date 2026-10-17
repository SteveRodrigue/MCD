---
type: Fixed
---

- **UI tests no longer reach the running dev server (#324)**
  - The happy-dom page URL is now a non-resolving origin, not `http://localhost:3000` (the dev server port), so UI tests stop writing into `stats/card_play_stats.json` and other local dev data.
  - A shared UI test setup answers every `/api/` request with 503, so services take their offline `localStorage` fallback and no request is aborted at teardown (removes the intermittent happy-dom `AbortError` traces).
