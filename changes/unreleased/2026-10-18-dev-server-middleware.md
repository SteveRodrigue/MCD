---
type: Security
---

- **Security (Dev tooling): Dev-server endpoints cannot write outside their folders (AUD-20261017-232534 F019)**
  - The Card Editor API accepted a `packFile` such as `../../x.json` and joined it into a read or write path. Pack file names must now be a bare `<name>.json`.
  - Endpoints that write to disk (game-state snapshots, problem reports, card stats, Card Editor saves) are registered on the dev server only; `vite preview` serves the build and card images.
  - The dev-server plugins share JSON body, response and download helpers; `vite.config.ts` shrinks from 566 to 353 lines.
