---
type: Fixed
---

- **Fix (Engine): Unify available-resource estimation across engine and UI (AUD-20261017-232534 R2)**
  - Merged redundant available-resource logic into `getAvailableResources` using `getGeneratorProvidedResources` and `getHandCardResourceValue`.
  - Generators producing multiple resources (or dynamically looking up discard resources like Pepper Potts) now correctly contribute their full value to available resource calculations.
  - Cards with uses counters but no resource ability (like Tac Team) no longer add spurious generator resources.
  - `evaluateCardPlayability` in `legality-checker.ts` delegates to `getAvailableResources` with excluded played card and aspect doubling support, eliminating the duplicate loop.
