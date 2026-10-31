---
type: Added
---

- **Feat (UI, Engine): Boost effect reveal modal and pause during combat resolution ([Issue #503](https://github.com/SteveRodrigue/MCD/issues/503))**
  - Implement pause at `phase: 'REVEAL_BOOST'` and enqueue `BOOST_ABILITY_REVEAL` prompt in `pendingDecisionQueue` when an enemy attack resolves a boost card with a star boost ability in interactive mode (`!attackContext.synchronousPolicy`).
  - Add `BoostEffectModal` presenting the revealed boost card, boost icons, star badge, and boost ability description in comic pop-art styling.
  - Implement pacing auto-advance according to `villainPhasePacing` (`auto_normal`: 900ms, `auto_fast`: 450ms, `instant`: 0ms) when `isAutoPlaying` is true, and manual player confirmation (Spacebar / Enter / click "Continue") when in manual mode or paused.
  - Decompose boost resolution into `continueBoostResolution`, `continueAttackAfterBoost`, `cleanupAttackOnAbort`, and `finishAttackAfterBoosts`, cleanly handling multi-boost sequences, lethal boost damage, multiplayer elimination, and defending ally defeat.
  - Fix missing `ALL_CONTROLLED_CHARACTERS` encounter card damage targeting case in `handleDealDamage`.
