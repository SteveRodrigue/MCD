---
type: Changed
---

- **Tooling: Upgraded Vite to 8.3.5 and `@vitejs/plugin-react` to 6.1.2 (Dependabot PR #401)**
  - Vite 8 bundles with Rolldown instead of Rollup. MCD used no Rollup-specific options, so `vite.config.ts` needed no migration.
  - Cleared Vite 8's native config-loader warning: `vite.config.ts` and `vitest.config.ts` use `import.meta.dirname`, and the files the config reaches (`src/data/supplemental/`, `src/tools/editor/api-middleware.ts`, `src/ui/components/templates/font-save.ts` and `font-test.ts`) import with explicit `.ts` extensions. `tsconfig.json` sets `allowImportingTsExtensions` for this (safe because `noEmit` is on).
