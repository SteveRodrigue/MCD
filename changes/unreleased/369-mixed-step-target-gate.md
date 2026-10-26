---
type: Fixed
---

- **Fix (Engine): A step that judges no target no longer excuses a missing target ([Issue #369](https://github.com/SteveRodrigue/MCD/issues/369))**
  - `checkAbilityTargets` replaces the "fewer judged steps than open steps" shortcut with `isAlwaysValidStep`: only an unconditional `DRAW` while the player has a card in deck or discard counts as a valid target (RR v1.8 "Target").
  - A conditional draw (Photonic Blast), a discard (Repulsor Blast) or a keyword grant (Relentless Assault) no longer lets an ability be played with nothing to target; an unconditional draw with empty deck and discard no longer does either.
  - ADR-0090 wording corrected.
