---
type: Added
---

- **Feat (Engine, Data): Masters of Mayhem minion activations and fallback search ([Issue #500](https://github.com/SteveRodrigue/MCD/issues/500))**
  - Implement Masters of Mayhem (01133) When Revealed ability: each Masters of Evil minion attacks the hero it is engaged with, with conditional fallback searching encounter deck and discard for a Masters of Evil minion if 0 attacks were made.
  - Generalize `ENEMY_ATTACKS` to support `filter` and `target: 'ENGAGED_HERO'`, tracking `attacksMadeCount` and emitting `amountZero: true` on 0 activations.
  - Add `ENGAGED_HERO` target selector across schema, effect parameters, and target resolvers.
  - Allow `pendingActivations` draining during Step 4 encounter card reveals in `combat-pipeline.ts`.
  - Pause pending sequences until all queued combat activations complete in `resumePendingSequence`.
