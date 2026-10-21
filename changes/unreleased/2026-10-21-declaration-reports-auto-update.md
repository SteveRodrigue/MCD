---
type: Changed
---

- **Tooling: declaration reports stay current automatically**
  - `report:declarations` no longer writes a `Generated:` timestamp, so regenerating without a change gives identical files; all report writes go through one `writeReport` helper, and `runDeclarationsAudit` accepts an `outDir`.
  - `.githooks/pre-commit` regenerates and stages `docs/reports/supplemental_data/` (and the legacy pointer) when `src/`, `data/upstream/`, `docs/ambiguities/` or `tools/audit/` is staged.
  - New test `tests/tools/declarations-report-fresh.test.ts` fails the push when a committed report differs from a fresh run.
  - Docs: removed 3 resolved reports and 14 read-through files, trimmed the read-through README, and fixed `IF_RESULT` in spec 10 (`result` with upper-case values).
