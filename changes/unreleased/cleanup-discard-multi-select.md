---
type: Fixed
---

- **End of Player Phase discard is one multi-select with a thumbnail on every card**
  - The clean-up prompt re-built its options without card codes after each discard, so the second and later prompts showed no thumbnails. It is now a single `PLAYER_CLEANUP` multi-select (`SelectCardsModal`): pick every card to discard, confirm once ("Keep all cards" when none is picked), per RR v1.8 p. 23.
  - Removed the one-card-at-a-time re-prompt loop, the `PLAYER_PHASE_DISCARD_CARD` / `FINISH_PLAYER_CLEANUP` effects, the `done_cleanup` option and the unused `player.phase.cleanup.cardDiscarded` log entry.
