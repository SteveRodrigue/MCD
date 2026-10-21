---
type: Added
---

- **Tooling: `npm run docs:check` keeps documentation current**
  - New `tools/audit/docs-check.ts` (allowlist: `tools/audit/docs-check.allow.json`) checks links and anchors, backticked paths, `npm run` scripts, `UPPER_SNAKE` symbols against `src/`, the ADR index, orphan documents, removed-feature wording and hard-coded counts; `--github` also compares roadmap checkboxes and milestones with GitHub.
  - `tests/tools/docs-check.test.ts` runs it in the full suite; `.githooks/pre-commit` runs it when documentation is staged; `npm run verify` includes it.
  - Rules and skills now point at it (post-task checklist, shared quality gates, commit-and-push, execute-plan, documentation-audit, next-task, feature-delivery, bug-fix) and the card-integration-protocol skill no longer names retired primitives and zones.
