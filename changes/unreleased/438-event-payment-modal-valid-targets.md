---
type: Fixed
---

- **Fix (UI/Engine): The payment modal offers only valid targets for an event ([Issue #438](https://github.com/SteveRodrigue/MCD/issues/438))**
  - Legal Practice (01023) no longer lists a scheme with no threat as a target, and the default target is the first valid one instead of the main scheme.
  - `CardPaymentModal` now takes its target list from the new engine function `getEventTargetChoice` (`src/engine/effects/target-choice.ts`); its hand-built scheme, enemy, heal, ally and player lists, the effect-name checks and the default-target chain are deleted (part of #366).
  - `checkAbilityTargets` matches a chosen main scheme by instance id, `main_scheme` or card code, so a code-named 0-threat main scheme is no longer accepted because another scheme has threat.
