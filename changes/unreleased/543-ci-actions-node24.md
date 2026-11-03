---
type: Changed
---

- **CI: Move GitHub Actions off the deprecated Node.js 20 runtime**
  - Bump `actions/checkout` and `actions/setup-node` to `@v7`, `actions/upload-artifact` to `@v7` and `actions/download-artifact` to `@v8`, which run on Node.js 24.
  - Add the `github-actions` ecosystem to Dependabot so future action majors are proposed automatically.
