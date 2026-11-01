---
type: Added
---

- **Feature (Content): The game explains itself when there is no content (M7)**
  - With no pack enabled, a welcome screen says so, states that MCD is an unofficial fan project, and shows the sync command with a copy button. Add content folder and Import pack (zip) are shown disabled with the reason.
  - A new Content screen (button on Mission Control, link on the welcome screen) lists every pack on disk as Playable, Data only, Needs pack or Failed, with the loader's reason.
  - A scenario of a pack that is not loaded is listed locked with "Needs <pack>". A pack that failed to load is named on the setup screens instead of only in the console.
  - `npm run pack:status` now prints the same states.
