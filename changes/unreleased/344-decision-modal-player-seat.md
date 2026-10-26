---
type: Fixed
---

- **Fix (UI): Show player and seat in decision prompt and interrupt modals ([Issue #344](https://github.com/SteveRodrigue/MCD/issues/344))**
  - Display deciding hero name, seat number, and themed pop-art badge in `DecisionPromptModal` and `SelectCardsModal`.
  - Add prominent multiplayer ribbon banner identifying the deciding player seat when multiple heroes are in play.
  - Extract reusable `resolvePlayerSeatInfo` helper to unify seat prefixing and formatting across `HeroZone`, `PlayerHandTray`, and decision modals.
