---
type: Added
---

- **Feat (Engine, Data): Tiger Shark minion self-tough on attack and villain tough boost ([Issue #498](https://github.com/SteveRodrigue/MCD/issues/498))**
  - Implement Tiger Shark (`01131`) Forced Response: after he attacks, give him a tough status card.
  - Implement Tiger Shark (`01131`) Boost: give the villain a tough status card.
  - Fix `SELF` target selector in `target-resolver.ts` to return live in-state minion and ally entity references.
  - Index `p.engagedMinions` in `findAnyCardInstance` lookup.
  - Streamline `MINION_ATTACKED` scenario driver in `ability-stage-setter.ts` to directly execute minion attack against the player, and pre-clear status cards in `primeForEffects`.
  - Resolve and delete ambiguity report `docs/ambiguities/core_encounter_01131_tiger-shark.md`.
