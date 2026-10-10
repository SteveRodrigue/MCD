# Supplemental Specification Quick Reference

> **High-Density Single Source of Truth Cheat Sheet**  
> For full details, see the modular guides in [`docs/specifications/supplemental/`](./README.md).  
> Validated against `schema.ts`, `effect-params.ts`, and `gate-params.ts` via `tests/data/quick-reference-sync.test.ts`.

---

## 1. Root Card Enrichment Anatomy

A card entry in `src/data/supplemental/pack/<pack>.json`:

```json
{
  "abilities": [/* CardAbility[] */],
  "playRequirements": {/* PlayRequirements */},
  "audit": {
    "rulesVersion": "v1.8",
    "confidence": 100,
    "originalText": "Exact printed card text here"
  },
  "uses": { "count": 3, "counterType": "all-purpose", "discardOnEmpty": true },
  "keywords": ["Guard", { "keyword": "Ranged" }],
  "isLandscape": false,
  "recipient": { "type": "CARD_SET_OWNER" },
  "noSupplementalNeeded": false
}
```

### Root Properties Summary

| Property                    | Type               | Description                                                                                           |
| :-------------------------- | :----------------- | :---------------------------------------------------------------------------------------------------- |
| `abilities`                 | `CardAbility[]`    | Actions, interrupts, responses, constants, setup, boosts.                                             |
| `playRequirements`          | `PlayRequirements` | Identity form, traits, control filters required to play/enter play.                                   |
| `audit`                     | `CardAuditRecord`  | Verification record: `rulesVersion`, `confidence`, `originalText`, etc.                               |
| `uses`                      | `CardUses`         | `count`, `counterType`, `discardOnEmpty`.                                                             |
| `keywords`                  | `KeywordEntry[]`   | String (`"Guard"`) or structured (`{ keyword: "Ranged", amount?: 1 }`).                               |
| `isLandscape`               | `boolean`          | True for landscape cards (e.g. main schemes).                                                         |
| `recipient`                 | `PlayerRecipient`  | `{ type: "FIRST_PLAYER" \| "REVEALING_PLAYER" \| "CARD_SET_OWNER" \| "IDENTITY", codes?: string[] }`. |
| `noSupplementalNeeded`      | `boolean`          | True for cards with no rules text or purely vanilla stats.                                            |
| `attackCost` / `thwartCost` | `number`           | Additional resource/cost penalty to attack or thwart.                                                 |
| `maxPerPlayer`              | `number`           | Maximum copies a single player may have in play.                                                      |
| `attachTo`                  | `AttachTo`         | Host selection (`VILLAIN`, `MINION`, `ENEMY`) and optional fallback `otherwise: SURGE`.               |
| `playUnderAnyPlayerControl` | `boolean`          | Player card can be played into another player's tableau.                                              |
| `restrictedSlots`           | `number`           | Occupies restricted weapon/item slots (default 1).                                                    |
| `additionalBoostCards`      | `number`           | Villain/enemy deals extra boost cards when activating.                                                |
| `victoryPoints`             | `number`           | Added to victory display when defeated.                                                               |
| `traits`                    | `string[]`         | Additional or override traits.                                                                        |
| `errata`                    | `string \| null`   | Formal errata text overlay.                                                                           |

---

## 2. Abilities, Timings & Triggers Matrix

### Ability Timing (`timing`)

| Timing                | Description                                                     |
| :-------------------- | :-------------------------------------------------------------- |
| `ACTION`              | Basic player action during player phase.                        |
| `HERO_ACTION`         | Action executable only while in Hero form.                      |
| `ALTER_EGO_ACTION`    | Action executable only while in Alter-Ego form.                 |
| `INTERRUPT`           | Executes immediately before a triggering event occurs.          |
| `HERO_INTERRUPT`      | Interrupt executable only while in Hero form.                   |
| `ALTER_EGO_INTERRUPT` | Interrupt executable only while in Alter-Ego form.              |
| `FORCED_INTERRUPT`    | Mandatory interrupt executed before the trigger occurs.         |
| `RESPONSE`            | Executes immediately after a triggering event resolves.         |
| `HERO_RESPONSE`       | Response executable only while in Hero form.                    |
| `ALTER_EGO_RESPONSE`  | Response executable only while in Alter-Ego form.               |
| `FORCED_RESPONSE`     | Mandatory response executed after the trigger resolves.         |
| `CONSTANT`            | Passive/continuous ability (no RESULT/CONTEXT gates allowed).   |
| `RESOURCE`            | Resource generation ability.                                    |
| `HERO_RESOURCE`       | Resource generation executable only in Hero form.               |
| `ALTER_EGO_RESOURCE`  | Resource generation executable only in Alter-Ego form.          |
| `SPECIAL`             | Special ability executed when invoked by card effects.          |
| `SETUP`               | Resolves during scenario setup.                                 |
| `WHEN_REVEALED`       | Mandatory encounter reveal effect.                              |
| `BOOST`               | Resolves when revealed as a boost card during enemy activation. |

### Event Triggers (`trigger`)

`ATTACK`, `ATTACK_DEFENDED`, `ATTACK_RESOLVED`, `BASIC_ATTACK_PERFORMED`, `BOOST`, `CARD_PLAYED`, `CHARACTER_DEFEATED`, `DAMAGE_TAKEN`, `DAMAGE_WOULD_BE_TAKEN`, `DEFEATED`, `ENCOUNTER_CARD_REVEALED`, `ENEMY_INITIATES_ATTACK`, `ENTERS_PLAY`, `FORM_CHANGED`, `HOST_ATTACK_ENDED`, `HOST_WOULD_ATTACK`, `MINION_ATTACKED`, `MINION_ENTERS_PLAY`, `PLAYER_PHASE_BEGAN`, `PLAYER_PHASE_ENDED`, `ROUND_BEGAN`, `ROUND_ENDED`, `SCHEME_DEFEATED`, `STATUS_REMOVED`, `THREAT_PLACED`, `THREAT_WOULD_BE_PLACED`, `THWART_RESOLVED`, `TREACHERY_REVEALED`, `VILLAIN_PHASE_BEGAN`, `VILLAIN_PHASE_ENDED`, `WHEN_REVEALED`.

### Trigger Filter (`triggerFilter`)

- `attackerKind`: `'VILLAIN'` | `'MINION'` | `'ANY_ENEMY'`
- `attackerCardFilter`: `UniversalCardFilter`
- `sourceCardCode` / `sourceInstanceId`: Filter by source card.
- `targetPlayerScope`: `'SELF'` | `'OTHER'` | `'ANY'`
- `targetScope`: `'HOST'` | `'SELF'` | `'OTHER'` | `'ANY'`
- `targetForm`: `'HERO'` | `'ALTER_EGO'`
- `targetType`: `'VILLAIN'` | `'MINION'` | `'ENEMY'` | `'SCHEME'` | `'CHARACTER'` | `'ALLY'`
- `attackedBy` / `defeatedByAttackOf`: `'YOUR_HERO'` | `'THIS_CARD'`
- `isEngaged`: `boolean`
- `defenderType`: `'HERO'` | `'ALLY'`
- `threatSource`: `'VILLAIN_PHASE_STEP_1'` | `'VILLAIN_SCHEME'` | `'MINION_SCHEME'` | `'CARD_EFFECT'` | `'INCITE'` | `'HAZARD'`
- `damageSource`: `'ATTACK'`

### Ability Costs (`cost`)

- `exhaustSelf`: `boolean`
- `exhaustCard`: `'SELF_IDENTITY'`
- `discardSelf`: `boolean`
- `resources`: Array of `'physical'` | `'energy'` | `'mental'` | `'wild'`
- `resourceCost`: `number` or specific count object
- `requirePrinted`: `boolean`
- `damageHero` / `damageSelf`: `number`
- `spendCounters`: `{ amount: number, counterType?: string, target?: 'SELF' | 'IDENTITY' }`
- `discardCard`: `{ from: 'HAND', count?: number, maxCount?: number, filter?: UniversalCardFilter, mode?: 'CHOSEN' | 'RANDOM' }`
- `heal`: `{ amount: number, target?: 'SELF' | 'TARGET' }`

---

## 3. Canonical Step Gates & Result Facts (ADR-0080)

Every step in `abilities[].steps` may define a `gate` and associated `gateParams`.

### Step Gates

| Step Gate                    | Kind      | `gateParams` Fields                                                                                                                                                        | Description                                              |
| :--------------------------- | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| `THEN`                       | `RESULT`  | `step` (opt: string), `negate` (opt: boolean)                                                                                                                              | Preceding step must succeed completely before executing. |
| `IF_RESULT`                  | `RESULT`  | `result` (req: `ResultFact`), `step` (opt: string), `negate` (opt: boolean)                                                                                                | Checks a factual outcome of an earlier step.             |
| `IF_FORM`                    | `STATE`   | `form` (req: `'HERO'` \| `'ALTER_EGO'`), `negate` (opt: boolean)                                                                                                           | Checks current player identity form.                     |
| `IF_PLAYER_HAS_TRAIT`        | `STATE`   | `trait` (req: string), `form` (opt: `'HERO'` \| `'ALTER_EGO'`), `negate` (opt: boolean)                                                                                    | Checks if identity has a specific trait.                 |
| `IF_ZONE_EMPTY`              | `STATE`   | `zone` (req: `'SIDE_SCHEMES'` \| `'ENCOUNTER_DECK'` \| `'ENCOUNTER_DISCARD'` \| `'HAND'` \| `'DECK'` \| `'DISCARD'`), `negate` (opt: boolean)                              | Checks if target zone is empty.                          |
| `IF_CARD_IN_PLAY`            | `STATE`   | `cardCode` (req: string), `negate` (opt: boolean)                                                                                                                          | Checks if a card by code is currently in play.           |
| `IF_RESOURCE_MATCH`          | `CONTEXT` | `resource` (req: string), `count` (opt: number), `printedResource` (opt: boolean), `only` (opt: boolean), `form` (opt: `'HERO'` \| `'ALTER_EGO'`), `negate` (opt: boolean) | Checks payment resources for matching types.             |
| `IF_UNDEFENDED_ATTACK`       | `CONTEXT` | `attackerKind` (opt: `'VILLAIN'` \| `'MINION'` \| `'ANY_ENEMY'`), `negate` (opt: boolean)                                                                                  | Checks if current incoming attack is undefended.         |
| `IF_ACTIVATION_DEALT_DAMAGE` | `CONTEXT` | `negate` (opt: boolean)                                                                                                                                                    | Checks if villain/minion activation dealt damage.        |

### Result Facts (`ResultFact`)

| Result Fact           | Producer Effects | Condition Verified                            |
| :-------------------- | :--------------- | :-------------------------------------------- |
| `TARGET_DEFEATED`     | `DEAL_DAMAGE`    | Target character was defeated by the damage.  |
| `EXCESS_DAMAGE_DEALT` | `DEAL_DAMAGE`    | Damage exceeded target remaining hit points.  |
| `FULLY_HEALED`        | `HEAL_DAMAGE`    | Target reached maximum hit points.            |
| `SCHEME_EMPTY`        | `REMOVE_THREAT`  | Threat on scheme reached 0.                   |
| `STATUS_APPLIED`      | `ADD_STATUS`     | Status card was newly added to the character. |
| `ALREADY_HAD_STATUS`  | `ADD_STATUS`     | Character already possessed that status card. |
| `STATUS_REMOVED`      | `REMOVE_STATUS`  | Status card was successfully discarded.       |
| `AMOUNT_ZERO`         | `ALL`            | Evaluated numeric amount resolved to 0.       |
| `DAMAGE_DEALT`        | `VILLAIN_ATTACKS`, `ENEMY_ATTACKS` | The attack dealt damage after step 6 (above 0); fact `damagedCharacter` feeds `DAMAGED_CHARACTER`. |

_Invariants:_

- `RESULT` gates (`THEN`, `IF_RESULT`) cannot be placed on step 0.
- `RESULT` or `CONTEXT` gates cannot be used in `timing: CONSTANT`.
- `step` parameter must reference an earlier step ID in the same ability.
- Referenced step effect must be a registered producer for `result` in `FACT_PRODUCERS`.

---

## 4. Effect Primitives & Allowed Parameter Keys

All 55 canonical effect primitives and their strictly allowed `effectParams` keys (`EFFECT_PARAM_KEYS`):

| Effect Primitive                          | Allowed `effectParams` Keys                                                                                                                                                                              | Description / Engine Behavior                                     |
| :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------- |
| `ADD_ACCELERATION`                        | `amount`                                                                                                                                                                                                 | Adds acceleration tokens to the main scheme.                      |
| `ADD_COUNTERS`                            | `amount`, `counterType`, `target`                                                                                                                                                                        | Adds specified counters to target card.                           |
| `ADD_STATUS`                              | `status`, `target`                                                                                                                                                                                       | Places `STUNNED`, `CONFUSED`, or `TOUGH` on target.               |
| `ADD_THREAT`                              | `amount`, `cardCode`, `condition`, `perPlayer`, `target`                                                                                                                                                 | Places threat on target or main scheme.                           |
| `ADD_TRAIT`                               | `duration`, `target`, `trait`                                                                                                                                                                            | Adds temporary trait to target character.                         |
| `ATTACHMENT_DAMAGE_SHIELD`                | `maxAbsorb`                                                                                                                                                                                              | Absorbs up to `maxAbsorb` damage from host attachment.            |
| `ATTACH_FACEDOWN_CARDS_FROM_HAND`         | _(none)_                                                                                                                                                                                                 | Attaches cards facedown under host card.                          |
| `ATTACH_TO_HOST`                          | `maxPerHost`, `target`                                                                                                                                                                                   | Attaches card to designated host enemy/card.                      |
| `CANCEL_ATTACK`                           | _(none)_                                                                                                                                                                                                 | Cancels the active enemy attack activation.                       |
| `CANCEL_WHEN_REVEALED`                    | _(none)_                                                                                                                                                                                                 | Cancels a when-revealed treachery or ability.                     |
| `CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER` | _(none)_                                                                                                                                                                                                 | Cancels treachery and draws a replacement encounter card.         |
| `CHANGE_FORM`                             | `form`, `optional`                                                                                                                                                                                       | Switches identity form to `HERO` or `ALTER_EGO`.                  |
| `DEAL_DAMAGE`                             | `amount`, `dynamicBonus`, `finisherBonus`, `target`, `targetPlayer`                                                                                                                                      | Deals damage to target enemy, character, or player.               |
| `DECLARE_DEFENDER`                        | _(none)_                                                                                                                                                                                                 | Exhausts self or marks character as defender.                     |
| `DISCARD`                                 | `count`, `fallback`, `filter`, `matchingDestination`, `mode`, `source`, `target`, `untilFilter`                                                                                                          | Discards card(s) from hand, deck, or play.                        |
| `DISTRIBUTE_AMOUNT`                       | `allocationDomain`, `budget`, `targetScope`                                                                                                                                                   | Distributes damage or threat across eligible targets.             |
| `DOUBLE_RESOURCE_FOR_ASPECT`              | `aspect`                                                                                                                                                                                                 | Doubles resource generation for a specific aspect.                |
| `DRAW`                                    | `count`, `dynamicBonus`, `limit`, `target`, `targetPlayerId`                                                                                                                                             | Draws card(s) from player deck.                                   |
| `ENEMY_ATTACKS`                           | `enemy`, `target`                                                                                                                                                                                        | Triggers immediate enemy attack activation.                       |
| `EXECUTE_SPECIAL`                         | `sequenceOrder`, `specialId`                                                                                                                                                                             | Invokes a named special ability script.                           |
| `EXHAUST`                                 | `filter`, `target`                                                                                                                                                                                       | Exhausts target card or character.                                |
| `FLIP_FORM`                               | _(none)_                                                                                                                                                                                                 | Flips identity card to opposite side.                             |
| `GENERATE_RESOURCE`                       | `amount`, `count`, `fromCard`, `resource`                                                                                                                                                                | Generates physical, energy, mental, or wild resources.            |
| `GIVE_ADDITIONAL_BOOST_CARD`              | _(none)_                                                                                                                                                                                                 | Adds a boost card to the running activation, attack or scheme.    |
| `GRANT_ATTACK_KEYWORD`                    | `keyword`                                                                                                                                                                                                | Grants keyword (`Overkill`, `Ranged`, `Piercing`) to next attack. |
| `GRANT_KEYWORD`                           | `amount`, `duration`, `keyword`, `target`                                                                                                                                                                | Grants keyword to target character for a duration.                |
| `HEAL_DAMAGE`                             | `amount`, `target`                                                                                                                                                                                       | Heals hit points on target friendly character/hero.               |
| `MODIFY_ALLY_LIMIT`                       | `amount`, `target`                                                                                                                                                                                       | Modifies ally capacity for player tableau.                        |
| `MODIFY_HAND_SIZE`                        | `amount`                                                                                                                                                                                                 | Modifies player maximum hand size.                                |
| `MODIFY_MAX_HEALTH`                       | `amount`, `target`                                                                                                                                                                                       | Modifies max hit point ceiling on target character.               |
| `MODIFY_RESTRICTED_LIMIT`                 | `amount`                                                                                                                                                                                                 | Modifies player restricted item limit.                            |
| `MODIFY_STAT`                             | `amount`, `atkBonus`, `duration`, `stat`, `target`, `targetPlayer`, `thwBonus`                                                                                                                           | Modifies ATK, THW, DEF, or REC on character.                      |
| `PLACE_CARD_UNDER_HOST`                   | _(none)_                                                                                                                                                                                                 | Places card tucked under host attachment.                         |
| `PLAYER_CHOICE`                           | `description`, `isVoluntary`, `options`, `title`                                                                                                                                                         | Prompts player with modal choice between option step lists.       |
| `PLAY_FROM_ZONE`                          | `control`, `costMode`, `costReduction`, `destination`, `filter`, `promptTitle`, `source`                                                                                                                 | Plays card directly from discard, deck, or out of play.           |
| `PREVENT_DAMAGE`                          | `amount`                                                                                                                                                                                                 | Prevents incoming damage from being dealt.                        |
| `PREVENT_THREAT`                          | `amount`, `target`                                                                                                                                                                                       | Prevents threat from being placed on scheme.                      |
| `PUT_INTO_PLAY`                           | `filter`, `from`, `reveal`, `target`, `to`                                                                                                                                                               | Puts card directly into play without paying cost.                 |
| `READY`                                   | `filter`, `target`                                                                                                                                                                                       | Readies target exhausted card or character.                       |
| `REDUCE_NEXT_CARD_COST`                   | `amount`, `cardFilter`, `duration`, `target`                                                                                                                                                             | Reduces resource cost of next played matching card.               |
| `REMOVE_COUNTERS`                         | `amount`, `counterType`, `target`                                                                                                                                                                        | Removes counters from target card.                                |
| `REMOVE_COUNTERS_MATCHING_FILTER`         | `amount`, `counterType`, `targetZone`, `traitFilter`                                                                                                                                                     | Removes counters across cards matching a zone/trait filter.       |
| `REMOVE_FROM_GAME`                        | `target`                                                                                                                                                                                                 | Removes target card from game permanently.                        |
| `REMOVE_STATUS`                           | `status`, `target`                                                                                                                                                                                       | Removes `STUNNED`, `CONFUSED`, or `TOUGH` status from target.     |
| `REMOVE_THREAT`                           | `amount`, `distinctFrom`, `dynamicBonus`, `finisherBonus`, `target`                                                                                                                                      | Removes threat from target scheme or main scheme.                 |
| `RETURN_TO_HAND`                          | _(none)_                                                                                                                                                                                                 | Returns target card from play/discard to owner's hand.            |
| `REVEAL_ENCOUNTER_CARD`                   | _(none)_                                                                                                                                                                                                 | Draws and reveals the next card from the encounter deck.          |
| `SEARCH`                                  | `autoSelectIfUnambiguous`, `distinctBy`, `filter`, `fromTop`, `lookCount`, `minimumTake`, `promptTitle`, `selectedDestination`, `shuffleAfter`, `source`, `takeCount`, `target`, `unselectedDestination` | Searches deck/discard for matching cards.                         |
| `SHUFFLE_INTO_DECK`                       | `count`, `filter`, `from`, `toDeck`                                                                                                                                                                      | Shuffles card(s) from discard/play into deck.                     |
| `SPEND_COUNTERS`                          | `amount`, `counterType`, `target`                                                                                                                                                                        | Spends counters from card as an ability effect.                   |
| `SURGE`                                   | _(none)_                                                                                                                                                                                                 | Discards encounter card and deals the surge card.                 |
| `TRANSFER_DAMAGE`                         | `amount`, `dynamicBonus`, `finisherBonus`                                                                                                                                                                | Moves damage from one character to another.                       |
| `VILLAIN_AND_ENGAGED_MINIONS_ATTACK`      | _(none)_                                                                                                                                                                                                 | Triggers attacks from villain and all engaged minions.            |
| `VILLAIN_ATTACKS`                         | _(none)_                                                                                                                                                                                                 | Triggers immediate villain attack activation.                     |
| `VILLAIN_SCHEMES`                         | `target`                                                                                                                                                                                                 | Triggers immediate villain scheme activation.                     |

---

## 5. Target Selectors & Dynamic Bonus Values

### Target Selectors (`TargetSelector`)

All 43 canonical target selectors (`TargetSelectorSchema`):

- **Self / Identity:** `SELF`, `SELF_IDENTITY`, `SELF_HERO`
- **Players:** `ACTIVE_PLAYER`, `ALL_PLAYERS`, `DEFENDING_PLAYER`, `CHOSEN_PLAYER`
- **Friendly Characters:** `ALL_HEROES`, `ALL_HEROES_AND_ALLIES`, `TRIGGERING_HERO`, `CHOSEN_ALLY`, `CHOSEN_CONTROLLED_ALLY`, `ALL_CONTROLLED_ALLIES`, `ALL_CONTROLLED_TABLEAU`, `ALL_ALLIES`, `CHOSEN_CHARACTER`, `CHOSEN_CONTROLLED_CHARACTER`, `ALL_CONTROLLED_CHARACTERS`, `CHOSEN_FRIENDLY_CHARACTER`, `ALL_FRIENDLY_CHARACTERS`, `ALL_CHARACTERS`, `DAMAGED_CHARACTER`
- **Enemies:** `VILLAIN`, `CHOSEN_ENEMY`, `ALL_ENEMIES`, `ENGAGED_ENEMIES`, `ENGAGED_MINIONS`, `CHOSEN_MINION`, `CHOSEN_ENGAGED_MINION`, `ALL_MINIONS`, `TRIGGERING_MINION`, `TRIGGERING_ENEMY`, `HOST_ENEMY`
- **Schemes:** `MAIN_SCHEME`, `CHOSEN_SCHEME`, `CHOSEN_SIDE_SCHEME`, `THIS_SIDE_SCHEME`, `ALL_SIDE_SCHEMES`, `ALL_SCHEMES`, `TRIGGERING_SCHEME`
- **Chained / Context:** `PREVIOUS_TARGET`, `PREVIOUS_SELECTED_CARD`, `HOST`

### Dynamic Value Source (`DynamicValueSource`)

Declarative calculation for amounts (`dynamicBonus`, `amount: { from: ... }`):

| `from` Source            | Required/Optional Fields                                                                                                     | Description                                            |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------- |
| `ENTITY_COUNT`           | `filter`, `target`                                                                                                           | Counts entities matching filter in play/zone.          |
| `DISCARDED_CARDS`        | `discardAttribute` (`COUNT`, `RESOURCE_ICONS`, `DIFFERENT_RESOURCES`, `BOOST_ICONS`, `DIFFERENT_CARD_TYPES`, `PRINTED_COST`) | Evaluates cards discarded as part of cost/step.        |
| `RESOURCES_SPENT`        | `resource` (`physical`, `energy`, `mental`, `wild`)                                                                          | Counts matching resources spent to pay card cost.      |
| `PREVIOUS_EXCESS_DAMAGE` | _(none)_                                                                                                                     | Excess damage dealt by preceding step.                 |
| `PREVIOUS_RESULT`        | _(none)_                                                                                                                     | Numeric return value from preceding step.              |
| `STAT_VALUE`             | `stat` (`ATTACK`, `THWART`, `DEFENSE`, `RECOVERY`, `THREAT`, `DAMAGE`, `SUFFERED_DAMAGE`, `HERO_ATK`), `target`              | Value of character attribute or damage counters.       |
| `COUNTERS`               | `counterType`, `targetCard` / `target`                                                                                       | Number of counters on target card.                     |
| `CARD_ATTRIBUTE`         | `attribute` (`PRINTED_COST`, `BOOST_ICONS`, `THREAT`, `DAMAGE`, etc.)                                                        | Inspects target card printed or current attribute.     |
| `INTERCEPTED_VALUE`      | _(none)_                                                                                                                     | Dynamic value intercepted from triggering event.       |
| `HAS_TRAIT`              | `target`, `trait`                                                                                                            | Evaluates if target possesses specified trait.         |
| `HAS_IDENTITY`           | `target`, `targetCardCode`                                                                                                   | Evaluates if target matches specific identity.         |
| `PAID_WITH_RESOURCE`     | `resourceType`                                                                                                               | Evaluates if ability was paid with specified resource. |

_Scaling Modifiers:_ `multiplier` (number), `offset` (number), `clamp: { min?: number, max?: number }`.

---

## 6. Universal Card Filter (`filter`) Fields

The universal composable card filter (`UniversalCardFilterSchema`) evaluates card criteria:

### Predicate Criteria Fields

| Field                | Type                | Example / Values                                                                                                               |
| :------------------- | :------------------ | :----------------------------------------------------------------------------------------------------------------------------- |
| `traits`             | `string[]`          | `["Avenger", "Aerial"]`                                                                                                        |
| `types`              | `CardType[]`        | `["ally", "event", "upgrade", "support", "minion", "treachery"]`                                                               |
| `names`              | `string[]`          | `["Iron Man", "Captain America"]`                                                                                              |
| `codes`              | `string[]`          | `["01001a", "01002"]`                                                                                                          |
| `aspects`            | `Aspect[]`          | `["aggression", "justice", "leadership", "protection", "basic", "encounter"]`                                                  |
| `cost`               | `NumberComparison`  | `{ min?: 1, max?: 3, equals?: 2 }` (supports `costMin` / `costMax` ranges)                                                     |
| `resourceIcons`      | `ResourceType[]`    | `["physical", "energy", "mental", "wild"]`                                                                                     |
| `hasKeyword`         | `Keyword`           | `'Guard'` \| `'Overkill'` \| `'Quickstrike'` \| `'Ranged'` \| `'Retaliate'` \| `'Toughness'` \| `'Hazard'` \| `'Acceleration'` |
| `hasStatus`          | `CharacterStatus[]` | `["STUNNED", "CONFUSED", "TOUGH"]`                                                                                             |
| `isUnique`           | `boolean`           | `true` \| `false`                                                                                                              |
| `isIdentitySpecific` | `boolean`           | `true` \| `false`                                                                                                              |
| `isExhausted`        | `boolean`           | `true` \| `false`                                                                                                              |
| `sets`               | `string[]`          | `["rhino", "spider_man"]`                                                                                                      |

### Composable Boolean Tree

Filters can be arbitrarily nested with logical operators:

- `all`: Array of child filters (logical AND)
- `any`: Array of child filters (logical OR)
- `none`: Array of child filters (logical NOT)
