---
type: Fixed
---

- **Fix (Engine & UI): "Call for Action" includes teammate identity in-play actions ([Issue #317](https://github.com/SteveRodrigue/MCD/issues/317))**
  - Extracts `getIdentityActionItems` in `legal-actions-generator.ts` to discover legal identity in-play actions uniformly for both active player and teammates.
  - Fixes cooperative scan in `getLegalActionsForPlayer` to include teammate identity in-play actions (e.g. Carol Danvers' _Commander_ `01010b`, Tony Stark's _Futurist_ `01029b`) in `callForActionItems`.
  - Updates `IdentityActionModal.tsx` to permit triggering in-play identity action abilities during `PLAYER_PHASE` by request per RR v1.8 p. 5 & 23, decoupling them from basic identity powers that strictly require active turn.
