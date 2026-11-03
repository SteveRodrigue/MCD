---
type: Added
---

- **Feat (Engine, Data): Avengers Tower (03024), shared next-card discounts and the Ally Limit rule ([Issue #284](https://github.com/SteveRodrigue/MCD/issues/284))**
  - Avengers Tower supplemental data (`content/packs/cap/supplemental/cap.json`): +1 ally limit while every ally you control is an Avenger, and an Action that makes the next Avenger ally played this phase cost 1 less. It is the first card to use `REDUCE_NEXT_CARD_COST.cardFilter`, which #284 proposed removing.
  - Discounts in effect are one list on the game state (`GameState.activeCostReductions`), each with the player who created it and the player who may use it. `target: "ALL_PLAYERS"` lets any player's next matching card use it up (owner ruling: the Tower says "played", not "you play"); Helicarrier still discounts the chosen player only. Removed the per-player list and its cached `costReductions` sum. An unused discount logs `cost.reduction.expired` when it ends.
  - New `STATE` step gate `IF_ALL_ALLIES_MATCH` (`filter`, `negate`), editable in the Card Editor with the card-filter builder. `IdentityFormSchema` moved to `schema-primitives.ts` to break an import cycle.
  - Ally Limit follows RR v1.8: allies can be played beyond the limit, and after every action a player above it gets an "Ally Limit Exceeded" prompt, ahead of enters-play responses, to discard allies down to it. This also covers a limit that drops (Avengers Tower or The Triskelion leaving play). The ally-limit gates now honor step gates and `target`; `getPlayerAllyLimit` merged into `getEffectiveAllyLimit`.
  - Fix: the Helicarrier player-choice prompt now keeps its source card, so the discount is named after Helicarrier instead of the hero (the engine used to hard-code the name).
