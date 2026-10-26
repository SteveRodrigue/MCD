---
type: Changed
---

- **Tooling: `@types/node` stays on the Node major CI runs on (Dependabot PR #414)**
  - Dependabot now ignores major updates of `@types/node`. Types for a newer Node than CI's (22) would let code use APIs the runtime lacks, and typecheck would not catch it. Raising the major means changing `node-version` in `.github/workflows/ci.yml` and the Dependabot rule together.
