---
type: Changed
---

- **Engine & Data: Declare conditional additional boost card Forced Interrupts and retire additionalBoostCards ([Issue #292](https://github.com/SteveRodrigue/MCD/issues/292))**
  - Retired the text-derived `additionalBoostCards` property from `card-loader.ts`, `VillainCard`, `MinionCard`, `dealBoostCards`, schemas, and test mocks.
  - Replaced `ENEMY_INITIATES_ATTACK` with generic `INITIATES_ATTACK` and `INITIATES_ACTIVATION` supporting trigger filters.
  - Initialized active boost resolution queue during activation initiation so `GIVE_ADDITIONAL_BOOST_CARD` dynamically appends facedown boost cards to the running activation.
  - Added optional `count: AMOUNT` to `GIVE_ADDITIONAL_BOOST_CARD` supporting dynamic expressions (such as `ENTITY_COUNT`).
  - Added `'TARGET_PLAYER'` to `TargetSelectorSchema` and supported controller scoping in `IF_CARD_IN_PLAY`.
  - Added `'ONCE_PER_ACTIVATION'` limit enum to `CardAbility`.
  - Declared supplemental Forced Interrupt abilities for Klaw I/II/III (`01113`, `01114`, `01115`), Ronan the Accuser I/II/III (`16103`, `16104`, `16105`), Baron Zemo (`50165b`, `50166b`), and Master Strategist (`04134`).
