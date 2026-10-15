---
type: Fixed
---

- **Fix (Engine): Retaliate damage to villain or minion routes through damage pipeline ([Issue #306](https://github.com/SteveRodrigue/MCD/issues/306))**
  - Routes Retaliate damage in `combat-pipeline.ts` (`step7_resolvePostAttackAndRetaliate`) through `applyDamageToTarget` instead of raw counter arithmetic.
  - Corrects retaliate triggering to include undefended attacks where the hero was the targeted character and survived (RR v1.8 p. 24, 38).
  - Handles villain defeat and stage progression (including final stage victory) and minion defeat (`dispatchDefeat`, `moveDefeatedCardToPile`) resulting from retaliate damage.
  - Respects enemy damage mitigation (Tough status cards, damage shields, and damage immunity) on Retaliate damage.
  - Adds dedicated localized combat log entry `RETALIATE_DAMAGE` with onomatopoeia `RETALIATE!`.
  - Guards minion post-attack triggered abilities (`MINION_ATTACKED` / `ATTACK`) from executing if the minion was defeated by Retaliate.

