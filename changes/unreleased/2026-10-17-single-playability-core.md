---
type: Fixed
---

- **Fix (Engine): The hand and the engine agree on which cards can be played (AUD-20261017-232534 F002)**
  - `canPlayCard` (dispatcher) and `evaluateCardPlayability` (hand tray, legal-action list, bot) now read one rule core, `collectPlayRestrictions`, instead of two copies that had drifted.
  - The hand now greys out an event whose extra hand-discard cost cannot be paid (She-Hulk's Legal Practice with no other card in hand); before, the engine rejected the play that the hand offered.
  - Generator resources come from the payment code's own `getGeneratorProvidedResources` in both checks. A card with Uses counters but no resource ability (Tac Team) no longer counts as a 1-resource generator anywhere.
  - Reason texts are aligned on the engine wording; a generator that cannot pay now reads "X cannot generate resources now."
  - New parity test runs every Core starter-deck card in hero and alter-ego form through both checks.
