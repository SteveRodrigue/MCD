---
type: Fixed
---

- **Fix (Engine/UI): Every threat removal is logged once per scheme with its source, and a main scheme blocked by Crisis or Patrol is announced ([Issue #343](https://github.com/SteveRodrigue/MCD/issues/343))**
  - Mark V Helmet with Aerial showed one "-1 THREAT" line when Crisis or Patrol silently skipped the main scheme. The log now has one `card.effect.removeThreat` entry per scheme (actor, source card, target, amount really removed, threat left) and a Crisis or Patrol line for the blocked main scheme.
  - One removal path: the new `removeThreatFromScheme` in `threat-pipeline.ts` now serves basic and ally thwart, card effects and both distributed-removal blocks (`damage.ts`, `prompts.ts`), which also did not log. Patrol blocking moved into `applyThwart` beside Crisis; encounter-card sources ignore both.
  - Removed the aggregate log line and the `player.action.thwartMainScheme` / `player.action.thwartSideScheme` keys. A side scheme defeat is now logged after its removal line and reads as a sentence.
  - A removal of 0 is logged by the engine and listed in the Combat Log in Dev Mode only.
