---
type: Security
---

- **Security (Tooling): Vitest 4.1.12 closes the `@vitest/mocker` advisories (Dependabot #21, #22)**
  - `vitest` and `@vitest/coverage-v8` move from `^4.1.11` to `^4.1.12`, which pulls in `@vitest/mocker` 4.1.12. This fixes GHSA-xp26-3454-mjgp (Windows backslash bypass of the redirect allowlist) and GHSA-qxg6-89mg-rqv8 (code injection through manual mock registration).
  - Both flaws need `mockerPlugin()` or `interceptorPlugin()` on a Vite dev server. MCD uses neither, so it was not exploitable here; the bump removes the dependency alert.
