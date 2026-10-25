---
type: Changed
---

- **Tooling: Updated `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` to 8.72.0 and grouped them in Dependabot (PRs #407, #409)**
  - `@typescript-eslint/eslint-plugin` requires a `@typescript-eslint/parser` of the same minor version, so a single-package PR conflicts with the other. Dependabot now bumps the two in one PR.
