---
type: Changed
---

- **Content is loaded at runtime instead of imported statically (M3 of the content folder refactor, ADR-0092)**
  - Added `src/data/content/`: a `ContentLoader` that reads the packs listed in `content/config.json` (plus their dependencies) through a driver (Node file system for tests and scripts, fetch for the browser), validates them, and disables a failing pack with a reason instead of failing the load.
  - `cardCatalog`, the supplemental registry, the modular sets and the starter decks start empty and are filled once at boot (`bootContent`), so the engine starts with zero packs. The app loads content in `main.tsx` before rendering, the Vite dev and preview servers serve `content/` read-only, tests load it through a setup file, and `simulate` and `cache:cards` boot it first.
  - Starter decks are listed by deck id (renumbered to keep Spider-Man first); the duplicate-identity check is shared between the loader and `pack:validate`.
