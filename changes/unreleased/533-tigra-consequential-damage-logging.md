---
type: Fixed
---

- **Fix (Engine): Log ally consequential damage as combat damage ([Issue #533](https://github.com/SteveRodrigue/MCD/issues/533))**
  - Emits `damage.applied.ally` with source `Consequential Damage` when consequential damage is dealt after ally attacks or thwarts.
  - Confirms Tigra (01051) trigger rules compliance: at 0 damage, she cannot heal per target legality rules and takes 1 consequential damage with combat log feedback; at 1+ damage, she heals before taking consequential damage per FAQ Appendix 04.
