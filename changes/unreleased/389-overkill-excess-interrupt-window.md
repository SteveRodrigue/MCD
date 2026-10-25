---
type: Fixed
---

- **Fix (Engine): the Overkill excess on a defeated ally's controller opens its own "would take" window ([Issue #389](https://github.com/SteveRodrigue/MCD/issues/389))**
  - A damage-prevention card in play or in hand (Cosmic Flight `01017`, Backflip `01003`) is offered for the excess, which RR v1.8 Overkill counts as damage from the attack. Answering Yes lowers it, No applies it; the attack resolves once, after the last answer.
  - The ally stays the defender shown in the prompt; its defeat is announced with the identity's, after the answer.

- **Fix (Engine): a hero with a Tough status card is no longer offered damage prevention for an attack Tough prevents**
  - The window moved from `step6_calculateAndApplyAttackDamage` into the damage pipeline, after Tough (RR v1.8 Damage, step 2 before step 3).
  - `resumeDamage` finishes a paused occurrence from plain data on the `PendingDamagePlacement`; the hand-written resume (and its dead non-attack branch) and the unused `damagePreventionAmount` are removed.
