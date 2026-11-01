---
type: Changed
---

- **Content moved into the pack layout (M4 of the content folder refactor, ADR-0092)**
  - Card data, supplemental data, translations, starter decks, scenario definitions and modular sets now live under `content/` (`content/packs/<code>/…` for the 63 official packs, `content/meta/` for the shared catalog data). `data/` and `src/data/supplemental/pack/` are gone. Behavior is unchanged.
  - Added `src/tools/content-paths.ts`, the single place that knows the layout; scripts, tools, tests and the Card Supplemental Editor use it.
  - Added `npm run pack:status` (cards and supplemental counts per pack) and a `pack.json` for every official pack. The pack id pattern now accepts the nine official codes with two letters or underscores.
  - Removed the unused upstream helper files and `scripts/sync_data.ps1` (its replacement, a TypeScript content sync, follows in M4b).
