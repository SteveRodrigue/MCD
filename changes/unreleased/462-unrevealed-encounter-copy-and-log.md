---
type: Fixed
---

- **Fix (UI & Engine): Clarify dealt encounter card tooltip and deck exhaustion combat log ([Issue #462](https://github.com/SteveRodrigue/MCD/issues/462))**
  - Update `FacedownEncounterCard.tsx` tooltip and peek modal copy from "Step 5" to "Step 4 of the Villain Phase", aligning with Marvel Champions Rules Reference v1.8 ("Reveal and Resolve Encounter Cards") and the engine state model.
  - Enrich the `player.deck.exhausted` combat log entry in English and French locales to clarify that the discard pile was reshuffled and 1 facedown encounter card was dealt.
  - Add end-to-end invariant test verifying that cards dealt from deck exhaustion remain unrevealed during the player phase and resolve during Step 4 of the villain phase.
