---
type: Added
---

- **Feat (Engine & UI): Card Play, Ability Usage, and Basic Action Stats ([Issue #315](https://github.com/SteveRodrigue/MCD/issues/315))**
  - Introduces headless per-game stats tracking on `GameState.stats` (`CardUsageStats`, `BasicActionSummary`, `GameStats`) recording card plays (player and encounter), ability executions (`executeEffect`), and basic actions across Heroes, Alter-Egos, Allies, Villains, and Minions.
  - Adds external file persistence in `stats/card_play_stats.json` (git-ignored) auto-created on first run via Vite server middleware `cardStatsPlugin()` (`GET /api/stats`, `POST /api/stats`, `POST /api/stats/reset`).
  - Provides `stats-storage-service.ts` with session delta syncing to accumulate all-time statistics without duplicate counts.
  - Displays comic pop-art quick stats recap directly inside `CardContextMenu.tsx` upon right-clicking cards, with a detailed breakdown modal `CardStatsModal.tsx`.
  - Implements DevMode safeguards for resetting statistics: single-card stats reset in `CardContextMenu` and all-time stats reset in `OptionsMenu`, both gated behind explicit confirmation modals and strictly hidden in normal mode.

