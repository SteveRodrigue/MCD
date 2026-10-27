---
type: Fixed
---

- **Fix (Engine/UI): Reset transient state on discard and leaves-play, preventing Web-Shooter from appearing exhausted in hand ([Issue #388](https://github.com/SteveRodrigue/MCD/issues/388))**
  - Enforce RR v1.8 p. 15 leaves-play / discard invariant by routing uses-counter depletion and cost discards through `discardCardInstance`, resetting exhaustion, tokens, counters, status cards, and attachments.
  - Extract universal card discard and cleanup into leaf module `src/engine/state/card-discard.ts`, eliminating duplicated attachment cascading in `cost-engine.ts`.
  - Fix boolean prop precedence in `CardView.tsx` so explicit `isExhausted={false}` takes priority, and enforce non-exhaustion for hand cards in `PlayerHandTray.tsx`.
