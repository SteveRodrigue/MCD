---
type: Changed
---

- **Test tooling (Engine): stats-driven Gauntlet for the card-ability simulation, phase 2 ([Issue #431](https://github.com/SteveRodrigue/MCD/issues/431))**
  - `npm run simulate` now also plays a Gauntlet of 20 full matches (solo and two players, Standard and Expert) with a coverage-seeking bot (`gauntlet.ts`). Decks come from a scarcity-weighted matchmaker (`scarcity-matchmaker.ts`) that leans toward untested cards and shared trigger windows; prompt choices rotate through every branch with a seed. A crash, `engine.stepError` or broken invariant fails the run and prints the `--replay gauntlet:<seed>:<n>` command; coverage and odd outcomes are only reported.
  - The player bot (`player-bot.ts`) takes an optional scarcity ledger: it now pays for untested abilities (resources, discards), uses encounter-card actions, flips form for untested form-bound abilities, takes a survivable hit to enable an untested heal, and spends cards with untested abilities last. Without a ledger it behaves as before; the free-cost-only ability restriction is gone.
  - Added the trigger-window sweep (two abilities on one trigger, forced before optional) to the Stage-Setter, and `--update-stats`, the only way a simulation run writes `stats/card_play_stats.json`.
  - The Gauntlet steers by the statistics file, so the replay catalog records a `statsBaseline` id: the same seed and baseline give byte-identical files, and `--no-stats` (baseline `none`) gives identical files whatever the file holds. `--stats-file <path>` redirects the baseline read and the `--update-stats` write. Paths no longer depend on the working directory.
  - A forced ability on an in-play card now writes the same `ability.<id>.triggered` log entry as the identity and optional paths, so the order of a trigger window can be read from the log.
