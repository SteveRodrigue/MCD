---
type: Changed
---

- **Changed (Tooling): Per-folder coverage thresholds and dead-export reporting (AUD-20261017-232534 R4, #325)**
  - Configured per-folder coverage ratchets in `vitest.config.ts` for `src/engine/**` (85% stmts, 71% branch, 89% funcs, 87% lines) and `src/ui/**` (74% stmts, 67% branch, 66% funcs, 76% lines).
  - Added `knip` dev dependency, `knip.json` configuration, and `"deadcode": "knip"` script to detect unused exports and orphaned files.
  - Documented the coverage ratchet policy in `docs/coding_guidelines.md` and `.agents/rules/shared-quality-gates.md`, and added `npm run deadcode` to the code audit skill.
