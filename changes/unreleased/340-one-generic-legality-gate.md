---
type: Fixed
---

- **Fix (Engine): One-Two Punch and other self-targeted abilities are no longer offered when they cannot change the board ([Issue #340](https://github.com/SteveRodrigue/MCD/issues/340))**
  - A second copy of One-Two Punch (`01024`) is skipped, with a log line, once the first has readied She-Hulk; it is not offered at all while She-Hulk is ready. The same rule now stops Arc Reactor, Indomitable and Tenacity from readying a ready hero, and Aunt May from healing at full health (RR v1.8 "Target": a target is valid only if the ability can affect it).
  - One generic legality gate (`checkAbilityTargets`, ADR-0090) now decides target validity for trigger scans, queued prompts, prompt answers, action buttons and event play. `legality-checker.ts`, `play.ts` and `abilities.ts` lost their duplicated HEAL/READY checks; `canAffect` is a rule table (`AFFECT_RULES`) fed self selectors as well as chosen ones.
  - Queued optional abilities are re-validated when they come up (`pruneStaleOptionalPrompts`), replacing the threat- and damage-interrupt-only pruning.
  - Guards: every schema effect needs a target-state rule or a stated reason, and no target-validity check by effect name may appear outside the gate (`tests/engine/legality-gate-guards.test.ts`). Guideline §15.11 and the agent rules record the one-gate rule.
