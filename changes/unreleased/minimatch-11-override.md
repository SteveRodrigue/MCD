---
type: Security
---

- **Force `minimatch` to 11.x with an npm override (Dependabot alert #24, GHSA-g3hv-75wg-m249)**
  - `minimatch` 10.2.6 can be made to use excessive CPU and memory by a crafted glob pattern. It is only used by ESLint (`eslint`, `@eslint/config-array`, `@typescript-eslint/typescript-estree`), so it runs during `npm run lint` and never ships in the bundle.
  - None of those packages accept `minimatch` 11 yet, so `package.json` now has `"overrides": { "minimatch": "^11.0.4" }`. Remove the override once ESLint and typescript-eslint depend on `minimatch` 11 directly: `tests/tools/npm-overrides-needed.test.ts` fails, naming the entry to delete, as soon as every dependent in `package-lock.json` accepts the installed version (`semver` is now a direct dev dependency for this check).
  - Lint checks the same 829 files before and after the change.
