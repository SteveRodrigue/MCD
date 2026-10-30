---
type: Added
---

- **Feat (Engine, Data): Whirlwind multi-hero attack interrupt and boost damage ([Issue #497](https://github.com/SteveRodrigue/MCD/issues/497))**
  - Implement Whirlwind's (01130) Forced Interrupt resolving sequential attacks against all other heroes upon attack initiation, plus boost star dealing 1 damage to each hero.
  - Add `ALL_OTHER_HEROES` target selector across schema, effect parameters, and target resolvers.
  - Decouple pending minion activations from controller engagement, allowing cross-player minion attacks via `getMinionById`.
  - Fix trigger scanner to include in-play minions in `scanInPlayTriggerAbilities`.
