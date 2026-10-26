---
type: Changed
---

- **Change (Simulation): Strategic player bot and defender policy ([Issue #309](https://github.com/SteveRodrigue/MCD/issues/309))**
  - `player-bot.ts`: one play function with value-based payment (generators first, then the cheapest hand cards), threat look-ahead for thwart and form decisions, Guard-first minion targeting, all thresholds in `BOT_POLICY`.
  - `chooseDefenderOption`: the simulator defends only when the coming attacks could take the hero near death (a defending hero loses its next turn).
  - Shared `getVillainPhaseThreatToAdd` (villain phase step 1) and `isGuardMinion` (restriction module).
  - `npm run simulate` prints and reports why each game ended.
  - Opening plan: thwart first for 3 rounds (side schemes before the main scheme), stun cards and draw abilities first, fill an empty tableau, one hero in Alter-Ego at a time.
  - `eliminatePlayer` drops the prompts addressed to the eliminated player (a Hawkeye trigger prompt crashed the simulation).
  - The win-rate target is not reached yet (0 of 100); the issue stays open.
