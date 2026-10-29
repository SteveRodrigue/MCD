---
type: Added
---

- **Feat (Engine, Data): Hydra Soldier (01182) DEAL_FACEDOWN_ENCOUNTER_CARD primitive and When Defeated minion trigger ([Issue #487](https://github.com/SteveRodrigue/MCD/issues/487))**
  - Implements `DEAL_FACEDOWN_ENCOUNTER_CARD` engine effect primitive, handling target player resolution and empty-deck encounter exhaustion (+1 acceleration token, discard reshuffled).
  - Unifies minion defeat cleanup across `defeatMinionsBeyondHitPoints` and `resolveDamage` into `resolveMinionDefeat`, resolving minion-declared `When Defeated` abilities before moving the card to discard per RR v1.8 while fully preserving `excessDamage` and Overkill spillover to the villain.
  - Adds `ENGAGED_PLAYER` to `TargetSelectorSchema` and resolves it dynamically to the player engaged with the minion.
  - Promotes `01182` (Hydra Soldier) in `core_encounter.json` to 100% confidence, deletes `docs/ambiguities/core_encounter_01182_hydra-soldier.md`, and adds comprehensive unit and overkill tests in `tests/engine/hydra-soldier.test.ts`.
