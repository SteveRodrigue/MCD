---
type: Fixed
---

- **Fix (Engine): Explain prior player-deck exhaustion penalty cards in Step 3 deal breakdown and update stepper event on reveal interrupt ([Issue #567](https://github.com/SteveRodrigue/MCD/issues/567))**
  - Refactored `buildDealStepEvent` in `src/engine/pipeline/villain-phase.ts` to distinguish newly dealt cards from prior penalty cards in threat zones (such as cards from player deck exhaustion).
  - Updated `advanceVillainPhase` to set `villainPhaseStepEvent` to `REVEAL_ENCOUNTER_CARD` immediately when revealing a card, preventing the stepper banner from remaining stuck on the stale Step 3 text during reveal interrupt decision prompts (e.g. Black Widow cancelling a treachery).
