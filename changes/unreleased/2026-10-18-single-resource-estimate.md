---
type: Fixed
---

- **Fix (Engine): Unify available-resource estimation in the legality checks (AUD-20261017-232534 R2)**
  - Merged redundant available-resource logic into `getAvailableResources` using `getGeneratorProvidedResources` and `getHandCardResourceValue`.
  - Generators producing multiple resources (or dynamically looking up discard resources like Pepper Potts) now correctly contribute their full value to available resource calculations.
  - Cards with uses counters but no resource ability (like Tac Team) no longer add spurious generator resources.
  - `evaluateCardPlayability` in `legality-checker.ts` delegates to `getAvailableResources` with excluded played card and aspect doubling support, eliminating the duplicate loop.
  - Every identity resource ability now counts, not just the first; used or wrong-form ones are skipped. `maxPotentialResources` is renamed `availableResources`.
  - The "play from discard" check excludes the played card and applies aspect doubling like the hand tray. The hero zone breakdown and the mid-resolution `PLAY_FROM_ZONE` handler still use the plain estimate.
