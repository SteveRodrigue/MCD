---
type: Added
---

- **Test tooling (Engine): rule scenarios for the simulation ([Issue #472](https://github.com/SteveRodrigue/MCD/issues/472))**
  - `rule-scenarios.ts` stages 17 situations the Rules Reference v1.8 describes through real engine actions: an ally defending, Tough, Toughness, Piercing, Overkill, Retaliate, Patrol, Crisis, Stun, Confuse, Recover, deck exhaustion, victory, the Ultron environment, an optional ability skipped without a valid target, a third Restricted card, and the last Uses counter. `npm run simulate` runs them with the Stage-Setter, and the log keys they write count as evidence for the rules in `rule-observations.ts`.
  - A rule no log key names can be observed by a passing scenario (`{ scenario }`), which checks the state itself: Restricted uses it. A scenario that does not write the keys it expects, or fails its own check, fails the run.
  - Tuck is now mapped to the effect Highway Robbery declares (`ATTACH_FACEDOWN_CARDS_FROM_HAND`).
  - Staging internals: `createStage` takes a `StageSubject` (card, seed, setup) instead of an ability target, and `openTriggerWindow` is split out of `exerciseTriggerWindow` so a scenario can read the finished state. Replay output is unchanged.
