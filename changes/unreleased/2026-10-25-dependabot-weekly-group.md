---
type: Changed
---

- **Tooling: Dependabot opens one weekly pull request for all minor and patch updates**
  - A `minor-and-patch` group collects every npm package that is not already in the `vitest`, `react` or `typescript-eslint` groups, so a normal week is one PR to merge instead of one per package. Major updates of other packages still open their own PR, since they need a closer look; `@types/node` majors stay ignored.
