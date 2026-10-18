---
type: Changed
---

- **Refactor (Data): Enforce Event discardSelf rule outside the editor (AUD-20261017-232534 R3)**
  - Extracted `findEventDiscardSelfViolations` helper into `src/data/supplemental/schema.ts` to enforce that event cards cannot declare `cost.discardSelf` per RR v1.8 Event.
  - Replaced inline check in Card Editor API middleware (`src/tools/editor/api-middleware.ts`) with `findEventDiscardSelfViolations`.
  - Added event `cost.discardSelf` validation to `validateCardInput` in `scripts/validate-card.ts`.
  - Added unit tests in `tests/data/event-discard-self.test.ts` for helper function, pack verification, and CLI validation rejection.

