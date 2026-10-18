---
type: Changed
---

- **Change (UI): Game-state snapshots run only in Dev Mode on the dev server (AUD-20261017-232534 F006)**
  - Every state change used to serialise the whole state twice (a sessionStorage copy and a POST body) and post it to `/api/logs/gamestate`, also in production builds where the endpoint does not exist.
  - Snapshots to `logs/gamestates/` now run only when the app is served by Vite (`import.meta.env.DEV`) with Dev Mode on, once the browser is idle; a newer state cancels a snapshot still waiting.
  - The sessionStorage copy is removed. Report a Problem embeds the live state from its prop or, when opened from a card context menu, from the board's game-state context.
