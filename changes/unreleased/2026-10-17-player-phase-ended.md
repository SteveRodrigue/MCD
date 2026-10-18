---
type: Fixed
---

- **Fix (Engine): "When the player phase ends" abilities fire in real games (AUD-20261017-232534 F003)**
  - `PLAYER_PHASE_ENDED` was dispatched only by `endPlayerPhase`, which no production path called. Both villain-phase runners now start with `endPlayerPhase` when they leave the player phase, after the clean-up discard, draw and ready (RR v1.8 End of Player Phase, steps 4 and 5). The trigger fires once per player, in player order.
  - One helper, `expireLastingEffects`, ends TURN, PHASE and ROUND effects (cost reductions, stat modifiers, granted traits). It replaces five copies; the instant villain-phase copy had stopped expiring PHASE traits. TURN-duration traits now also end with the turn.
  - Removed the test-only `passActivePlayer` and the dead `thwBonus`/`atkBonus` token clean-up.
