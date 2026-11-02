---
type: Fixed
---

- **Fix (Engine, UI): Ability/Boost text splitter and headless boost reveal prompt ([Issue #528](https://github.com/SteveRodrigue/MCD/issues/528))**
  - Extract printed card text into `abilityText` and `boostText` at card normalization time via `splitCardText` in `card-loader.ts`.
  - Remove `getBoostAbilityText` and all presentation HTML regex parsing from `src/engine/pipeline/boost-resolution.ts`.
  - Clean up `BoostEffectModal` and `CombatBoostModal` to render boost abilities via `FormattedCardText` using typed `card.boostText`.
  - Pass attacker/schemer card code into `BOOST_ABILITY_REVEAL` prompt triggers, enforcing card thumbnail anchoring across all 7 themes.
