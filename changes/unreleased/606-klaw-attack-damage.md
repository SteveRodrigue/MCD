---
type: Fixed
---

- **Fix (Data): Klaw "attack dealt damage" cards ([Issue #606](https://github.com/SteveRodrigue/MCD/issues/606))**
  - Added audited supplemental declarations for Sonic Converter (`01118`), Klaw's Vengeance (`01122`), and Sonic Boom (`01123`).
  - Passed `activationDamage` and `damagedCharacter` to `HOST_ATTACK_ENDED` attachments in combat pipeline.
  - Extended `IF_ACTIVATION_DEALT_DAMAGE` gate to support `target: 'YOU'` qualifier per RR v1.8 "You, Your".
  - Added targeted test coverage in `tests/engine/klaw-attack-damage-606.test.ts`.
