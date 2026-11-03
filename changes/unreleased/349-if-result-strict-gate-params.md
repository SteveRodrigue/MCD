---
type: Changed
---

- **Refactor (Engine): Remove legacy `fact` and aliases from `IF_RESULT` gate ([Issue #349](https://github.com/SteveRodrigue/MCD/issues/349))**
  - Aligns the `IF_RESULT` gate evaluator strictly with `IfResultGateParamsSchema` by evaluating only `gateParams.result` and the 9 canonical `ResultFact` enum values.
  - Removes the legacy `fact` key, camelCase regex normalization, and duplicate alias cases (`DEFEATED`, `EXCESS_DAMAGE`, `THREAT_ZERO`, `STATUS_ADDED`).
  - Cleans duplicate alias properties (`defeated`, `threatZero`, `statusAdded`, `villainDefeated`) from `StepFacts` and effect handlers.
