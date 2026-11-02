---
type: Fixed
---

- **Fix (Tooling): `npm run dev` no longer warns that the Vite config is unsupported by the native config loader ([PR #558](https://github.com/SteveRodrigue/MCD/pull/558))**
  - Added `.ts` extensions to the imports the Vite config reaches, and `card-art.ts` imports `CardType` as a type only.
  - Moved `DIFFICULTY_MODES` into `engine/models/difficulty.ts` and gave the supplemental schemas plain enum value lists (`enum-values.ts`, kept equal to the enums by a test), so the config no longer loads TypeScript enums or directory imports.
