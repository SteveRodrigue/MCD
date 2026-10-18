---
type: Fixed
---

- **Fix (Engine): An instant villain phase no longer stops after a damage assignment or a cancelled prompt (AUD-20261017-232534)**
  - Answering a distribution prompt (Explosion), cancelling a prompt, ordering simultaneous abilities or resolving Wakanda Forever! during the villain phase returned before the phase continued; with "instant" pacing the game stayed in the villain phase.
  - The resume step now runs once in `dispatchAction` after every `RESOLVE_DECISION_PROMPT` and `DECLARE_DEFENDER`, after a paused ability sequence has finished; the two copies inside the action cases are removed.
