---
type: Fixed
---

- **Fix (Engine/UI): Include in-play ally Action abilities in legal actions and active action counts ([Issue #594](https://github.com/SteveRodrigue/MCD/issues/594))**
  - Generalize the board action scanner in `legal-actions-generator.ts` to scan both `player.tableau` and `player.allies`, discovering legal ally Action abilities like Hellcat's return-to-hand (`01020`) even when exhausted after attacking.
  - Prevent premature "End Turn" confirmation modal when legal ally actions remain.
  - Align `AllyActionModal.tsx` with ADR-0090 by delegating to `canInitiateAbility` and routing through `HeroZone` payment modal handling.
