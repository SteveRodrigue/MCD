---
type: Added
---

- **Feat (Engine, Data): Madame Hydra (01181) - damage immunity and Forced Response threat on Legions of Hydra ([Issue #489](https://github.com/SteveRodrigue/MCD/issues/489))**
  - Evaluates `step.gate` on `CANNOT_TAKE_DAMAGE` steps in `isImmuneToDamage` so conditional damage immunity is respected across attacks, damage effects, and targeting restrictions.
  - Adds `MINION_SCHEMED` trigger to `TriggerTypeSchema` and dispatches minion post-scheme forced responses in `executeMinionSchemeAgainstPlayer`.
  - Stages `MINION_SCHEMED` and in-play witnesses for `IF_CARD_IN_PLAY` in `ability-stage-setter.ts`.
  - Wires supplemental abilities for Madame Hydra (`01181`) with 100% confidence, deletes `docs/ambiguities/core_encounter_01181_madame-hydra.md`, and adds comprehensive tests in `tests/engine/madame-hydra.test.ts`.
