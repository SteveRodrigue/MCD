---
type: Fixed
---

- **Fix (Engine): Apply ally consequential damage after attack/thwart triggered response abilities ([Issue #385](https://github.com/SteveRodrigue/MCD/issues/385))**
  - Defers consequential damage when decision prompts are queued, per RR v1.8 and FAQ Appendix 04 (Tigra #51). Tigra now heals before consequential damage is dealt, allowing her to survive when at 1 HP, and cannot trigger heal when at 0 damage.
  - Consolidates duplicated ally defeat and consequential damage execution across `handleAllyAttack` and `handleAllyThwart` into `src/engine/pipeline/consequential-damage.ts`.
