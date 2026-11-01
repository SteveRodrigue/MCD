---
type: Changed
---

- **Refactor (Engine): Simplify the boost, damage and trigger code from #510, #513, #514 and #516**
  - The interactive boost reveal (#503) now uses the one shared boost loop: `resolveBoostCards` can pause before a star ability and resume, replacing a hand-copied loop in `combat-pipeline.ts`.
  - The step-through boost path now checks `boostStar` like the headless path, and the attacking minion is looked up live before boost cards are dealt.
  - `damage-pipeline.ts`: one `minionDefeatIsAverted` helper for the "would be defeated" window and one `DAMAGE_TAKEN` dispatch for heroes and villains.
  - `damage.ts`: the four "all characters" selectors share one helper; `ALL_FRIENDLY_CHARACTERS` and `ALL_CONTROLLED_CHARACTERS` now skip eliminated players like the others (#246).
  - Smaller cleanups in `trigger-dispatcher.ts`, `attachment-host.ts`, `villain-phase.ts` and `ability-stage-setter.ts`.
  - Rules review of multi-target damage recorded in `docs/backlog/plan_issue_523_simultaneous_multi_target_damage.md` ([Issue #523](https://github.com/SteveRodrigue/MCD/issues/523)).
