---
type: Changed
---

- **Tooling: The import-cycle audit follows every `tsconfig.json` path alias and scans all of `src` ([Issue #339](https://github.com/SteveRodrigue/MCD/issues/339))**
  - `npm run audit:import-cycles` and `tests/tools/import-cycles.test.ts` now fail on a cycle that leaves `src/engine` through `@data`, `@ui` or `@assets` and re-enters it. A fixture test covers an engine to data to engine cycle.
