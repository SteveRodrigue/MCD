---
type: Added
---

- **Tooling: Weekly GitHub Action checks `content/` against the zzorba upstream dataset ([Issue #568](https://github.com/SteveRodrigue/MCD/issues/568))**
  - `.github/workflows/upstream-sync-check.yml` runs `npm run content:sync -- --check` every Monday (and on demand). When it finds differences it opens, or comments on, one `upstream-sync` issue; it never writes to `content/`.
