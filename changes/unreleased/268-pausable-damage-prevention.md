---
type: Changed
---

- **Pausable `DAMAGE_WOULD_BE_TAKEN` Prevention Across All Damage Sources (Issue #268):**
  - Unifies the Step-3 `"When [target] would take any amount of damage..."` (`DAMAGE_WOULD_BE_TAKEN`) interrupt window in `resolveDamage` (`src/engine/pipeline/damage-pipeline.ts`) so every damage occurrence to a player identity (enemy attacks, Overkill excess, `DEAL_DAMAGE` ability/treachery damage, `DISTRIBUTE_AMOUNT` indirect damage, and `RETALIATE`) pauses into `state.pendingDamagePlacements` when a prompt opens and finishes through `resumeDamage` once the prompt window closes.
  - Removes `DamageRequest.dispatchDamageTaken`, `dealDamageToIdentity`, and `AttackExecutionContext.pendingDamage`, and collects all eligible in-play optional `DAMAGE_WOULD_BE_TAKEN` abilities in `scanInPlayTriggerAbilities` (`src/engine/triggers/trigger-dispatcher.ts`) so cards like _Cosmic Flight_ (`01017`) can prevent non-attack damage and prune moot follow-up prompts when incoming damage reaches `0`.
