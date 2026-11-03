---
type: Fixed
---

- **Fix (Tooling): Remove the empty retired Step Conditions section from the supplemental reports ([Issue #313](https://github.com/SteveRodrigue/MCD/issues/313))**
  - Deleted the `StepConditionSchema` stub and every Step Conditions usage scan, table, coverage row and count in `tools/audit/supplemental-declarations-analyzer.ts` and `tools/audit/schema-engine-coverage.ts` (retired by ADR-0080).
  - Renamed retired "Condition Gates" labels to "Step Gates" (`StepGateSchema`); the detailed report is now `step_gates_usage.md` and the broken `#1-condition-gates-conditiongateschema` link is fixed.
  - Renamed `extractConditionGateEvaluatorCases` to `extractStepGateEvaluatorCases` and updated test titles that named retired schemas.
