---
type: Changed
---

- **Tooling: `npm run deadcode` (knip) is now a blocking CI step and part of `npm run verify` ([Issue #325](https://github.com/SteveRodrigue/MCD/issues/325))**
  - knip now follows `src/**/*.css`, so the `@fontsource` fonts loaded through CSS `url()` are no longer reported as unused.
  - Removed the unused `effectsMissingContract` function and the unused `DIFFICULTY_MODES` re-export from `state.ts`.
