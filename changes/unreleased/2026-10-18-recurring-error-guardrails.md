---
type: Changed
---

- **Changed (Docs): Recurring-error guardrails in the coding guidelines**
  - Added `docs/coding_guidelines.md` §15 with 10 short rules and bad/good examples, drawn from recent code-review findings and fix commits (fail-closed validators, identify by code, one source of truth, type guards instead of `as any`, deterministic engine, owned UI timers, confined dev-server writes, path-covering tests, consistent flag checks, deleting orphaned code).
  - Added a matching summary to `.agents/rules/coding-and-testing-rules.md`.
