---
type: Added
---

- **Tooling (Data): Cross-platform content sync CLI (`npm run content:sync`, ADR-0092 M4b)**
  - Replaces the deleted `scripts/sync_data.ps1`: downloads the upstream dataset and materializes cards, catalog metadata, schemas and translations into the `content/` pack layout, preserving each pack's `pack.json` and `supplemental/`. Supports `--from <dir>`, `--check` and `--prune`.
