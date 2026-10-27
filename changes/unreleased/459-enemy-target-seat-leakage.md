---
type: Fixed
---

- **Fix (Engine & UI): Strip player seat leakage from enemy target prompt labels ([Issue #459](https://github.com/SteveRodrigue/MCD/issues/459))**
  - Corrected `describeTarget()` in `src/engine/effects/target-choice.ts` so enemy minions are not classified as controlled by players, preventing engaged player seat designations (e.g. `(Hero Seat 1 (Black Panther))`) from appending to minion target labels.
  - Added duplicate minion disambiguation to `targetChoiceOptions()` to append `(engaged with <Hero>)` only when multiple candidate minions share the identical card name.
  - Updated `CardPaymentModal` to describe cross-player engaged minions as `(engaged with <Hero>)` instead of falsely attributing ownership.
