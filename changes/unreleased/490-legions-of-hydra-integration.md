---
type: Added
---

- **Test (Engine): Legions of Hydra modular set integration, interaction tests, and simulation verification ([Issue #490](https://github.com/SteveRodrigue/MCD/issues/490), [Issue #355](https://github.com/SteveRodrigue/MCD/issues/355))**
  - Adds normalization tests for `legions_of_hydra` modular encounter cards in `tests/data/card-loader.test.ts`.
  - Adds comprehensive Rhino modular integration tests in `tests/engine/legions-of-hydra.test.ts` verifying modular deck building (2x 01180, 1x 01181, 3x 01182) and cross-card interactions between Legions of Hydra (01180), Madame Hydra (01181), and Hydra Soldier (01182).
  - Unwraps `target.entity` in `isImmuneToDamage` to safely handle direct DamageTarget references.
  - Verifies 100% ability coverage and clean completion across 20/20 Gauntlet matches in `npm run simulate`.
