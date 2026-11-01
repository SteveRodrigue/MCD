---
type: Changed
---

- **Pack hooks: official packs ship their own code (M5a of the content folder refactor, ADR-0092)**
  - Wakanda Forever moved from `src/engine/specials/` into the Core pack (`content/packs/core/scripts/`). A generated import map (`tools/generate-pack-hooks.ts`, run by `npm run schema:generate`) lists every pack with scripts; `applyContent` registers the special handlers of the loaded packs and `resetContent` clears them. `pack:validate` fails an official pack that has scripts but no map entry.
  - Removed the hard-coded Black Panther upgrade codes (all four cards carry the Black Panther trait the handler already checks) and the handler's import-time registration.
  - `content/` scripts are now part of `tsconfig`, `lint` and `knip`.
