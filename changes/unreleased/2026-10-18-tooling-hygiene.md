---
type: Changed
---

- **Change (Tooling): Lint covers tests, tools and scripts (AUD-20261017-232534 F021)**
  - `npm run lint` (and the pre-commit hook) now checks `tests/`, `tools/` and `scripts/` as well as `src/`; they were already clean.
  - `ENGINE_VERSION` is read from `package.json` instead of a hard-coded `0.1.0` that had fallen behind the package version (`0.1.1`).
  - Deleted the root `implementation_plan.md`, a delivered Card Editor plan whose backlog copy was already removed.
