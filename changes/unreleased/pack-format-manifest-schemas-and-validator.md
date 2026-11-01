---
type: Added
---

- **Content pack format: manifest, scenario and modular-set schemas, hook contract and `pack:validate` (M2 of the content folder refactor)**
  - Added `src/data/packs/` with the pack manifest, scenario definition, modular set and pack deck schemas, plus generated JSON schemas wired into VS Code. `ScenarioDefinition` is now derived from its schema and the three built-in `definition.json` files are validated against it.
  - Added the types-only `src/engine/plugin-api` hook contract and `PACK_API_VERSION`.
  - Added `npm run pack:validate` (manifest, reserved IDs, per-file schemas, duplicate and dependency checks).
