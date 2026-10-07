# 05. Combat, Damage & Threat Effect Primitives

---

## 1. Combat & Damage Primitives

### `DEAL_DAMAGE`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L43`](../../../src/engine/effects/index.ts#L43))
- **Description:** Deals flat or dynamically calculated damage to target enemy or character. Handles Tough status removal, overkill, and character defeat.
- **Always through the damage pipeline (#247, ADR-0078):** every target kind (chosen minion, villain, `ENGAGED_ENEMIES`, `ALL_ENEMIES`, `ALL_CHARACTERS`, the identity selectors, `ALL_HEROES`, the `ALL_HEROES_AND_ALLIES` assignment) builds its target list and calls `applyDamageToTarget` once per target. So Tough, damage shields ("would be dealt" / "would be taken"), defeat triggers, Overkill, excess damage and the hero-defeat loss are applied the same way for every target, and `isAttack` (from `effectParams.isAttack` or the context) decides Retaliate and attack-only shields. The step's prompts (choose a player, explosion distribution) are unchanged.
- **Overkill:** when the step has Overkill (`overkill`, `overkillOnCondition` with its kicker met, or the Overkill keyword) and the target is a minion that is defeated, the damage beyond the minion's remaining hit points is dealt to the active villain through the pipeline (so the villain's Tough and shields apply).
- **Excess and defeat:** the pipeline result carries `excessDamage` and `targetDefeated`; a chosen-minion step with `condition: "EXCESS_DAMAGE_DEALT"` reads the first, `condition: "TARGET_DEFEATED"` the second.
- **Hero defeat:** a hero reduced to 0 hit points is eliminated (`eliminatePlayer`, ADR-0079), in the pipeline only. The remaining heroes keep playing; the game is lost when the last hero is eliminated.

```json
{
  "effect": "DEAL_DAMAGE",
  "effectParams": {
    "amount": 8,
    "target": "CHOSEN_ENEMY",
    "piercing": false,
    "ranged": false
  }
}
```

| Parameter          | Type                           | Required | Default          | Description                                                                              |
| :----------------- | :----------------------------- | :------- | :--------------- | :--------------------------------------------------------------------------------------- |
| `amount`           | `number \| DynamicValueSource` | Yes      | -                | Base damage value (flat integer or dynamic formula).                                     |
| `target`           | `TargetSelector`               | Yes      | `"CHOSEN_ENEMY"` | Target recipient.                                                                        |
| `targetPlayer`     | `'SELF' \| 'CHOSEN_PLAYER'`    | No       | `"SELF"`         | With `target: "ENGAGED_ENEMIES"`: whose engaged minions (plus the Villain) are hit. `CHOSEN_PLAYER` prompts in multiplayer and auto-resolves in solo (e.g. *Energy Daggers* `01046`). |
| `piercing`         | `boolean`                      | No       | `false`          | Discards Tough status card before dealing damage.                                        |
| `ranged`           | `boolean`                      | No       | `false`          | Ignores Retaliate keywords on the target.                                                |
| `finisherBonus`    | `number`                       | No       | -                | Bonus damage when ability resolves as final step in a sequence (e.g. *Wakanda Forever!*). |
| `dynamicBonus`     | `number \| DynamicValueSource` | No       | -                | Dynamic bonus damage added to amount (e.g. *Supersonic Punch* `01032`).                  |

---

### `GRANT_KEYWORD`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts), ADR-0054)
- **Description:** Dynamically grants a keyword (such as Retaliate, Overkill, Piercing, Ranged) to a target character (identity, ally, minion). Under ADR-0054, parameterized keywords like Retaliate stack additively across multiple active instances and temporary grants.

```json
{
  "effect": "GRANT_KEYWORD",
  "effectParams": {
    "keyword": "Retaliate",
    "amount": 1,
    "duration": "PHASE",
    "target": "SELF"
  }
}
```

| Parameter  | Type                 | Required | Default   | Description                                                                                    |
| :--------- | :------------------- | :------- | :-------- | :--------------------------------------------------------------------------------------------- |
| `keyword`  | `string`             | Yes      | -         | The keyword name being granted (e.g. `"Retaliate"`, `"Overkill"`, `"Piercing"`).                |
| `amount`   | `number`             | No       | -         | Numeric magnitude for parameterized keywords (e.g. `1` for Retaliate 1). Stacked per ADR-0054. |
| `duration` | `"PHASE" \| "ROUND"` | No       | `"PHASE"` | Lifecycle window for temporary keyword grant.                                                  |
| `target`   | `TargetSelector`     | No       | `"SELF"`  | Target character receiving the keyword.                                                        |

---

### `TRANSFER_DAMAGE`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts))
- **Description:** Moves / transfers damage from one character (e.g. hero) to an enemy (Villain or engaged minion). Heals the source and deals the damage to the target through the damage pipeline like `DEAL_DAMAGE` (#247, ADR-0078): Tough, damage shields, defeat triggers and villain defeat apply, and in an ability labelled `ATTACK` it is an attack by the player's identity (Retaliate applies).

```json
{
  "effect": "TRANSFER_DAMAGE",
  "effectParams": {
    "amount": 1,
    "finisherBonus": 1,
    "from": "SELF",
    "to": "CHOSEN_ENEMY"
  }
}
```

| Parameter       | Type                           | Required | Default          | Description                                                                                 |
| :-------------- | :----------------------------- | :------- | :--------------- | :------------------------------------------------------------------------------------------ |
| `amount`        | `number \| DynamicValueSource` | Yes      | `1`              | Base damage amount moved.                                                                   |
| `finisherBonus` | `number`                       | No       | -                | Bonus damage transferred when ability resolves as final step in a sequence (e.g. *Wakanda Forever!*). |
| `dynamicBonus`  | `number \| DynamicValueSource` | No       | -                | Dynamic bonus damage added to amount.                                                       |
| `from`          | `TargetSelector`               | No       | `"SELF"`         | Source character from which damage is healed.                                               |
| `to`            | `TargetSelector`               | No       | `"CHOSEN_ENEMY"` | Destination enemy receiving direct damage.                                                  |

---

## 2. Threat & Scheme Primitives

### `REMOVE_THREAT`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L120`](../../../src/engine/effects/index.ts#L120))
- **Description:** Removes threat from Main Scheme, Side Scheme, or chosen scheme. Enforces Crisis keyword restrictions and Patrol: when the resolving player is engaged with a Patrol minion, the main scheme is never a target of a player card effect (same filter as Crisis, for every scheme selector including `ALL_SCHEMES`).
- **"From each scheme instead if you have Aerial"** (Mark V Helmet `01037`): there is no `aerialAllSchemes` parameter. Use two steps, `target: "CHOSEN_SCHEME"` gated `IF_CONDITION_NOT_MET` and `target: "ALL_SCHEMES"` gated `IF_CONDITION_MET`, both with `condition: "TARGET_TRAIT_MATCH"` and `gateParams: { trait: "Aerial" }` (see [10. Sequences & Modals](10_sequences_and_prompts.md#choosing-between-if_condition_met-if_condition_not_met-and-if_failed)).

```json
{
  "effect": "REMOVE_THREAT",
  "effectParams": {
    "amount": 3,
    "target": "MAIN_SCHEME"
  }
}
```

| Parameter          | Type                           | Required | Default         | Description                                                                                 |
| :----------------- | :----------------------------- | :------- | :-------------- | :------------------------------------------------------------------------------------------ |
| `amount`           | `number \| DynamicValueSource` | Yes      | `1`             | Base threat amount removed.                                                                 |
| `target`           | `TargetSelector`               | No       | `"MAIN_SCHEME"` | Target scheme (`MAIN_SCHEME`, `CHOSEN_SCHEME`, `THIS_SIDE_SCHEME`).                         |
| `finisherBonus`    | `number`                       | No       | -               | Bonus threat removed when ability resolves as final step in a sequence (e.g. *Wakanda Forever!*). |
| `dynamicBonus`     | `number \| DynamicValueSource` | No       | -               | Dynamic bonus threat added to amount.                                                       |
| `ignoresCrisis`    | `boolean`                      | No       | `false`         | Removes threat from the Main Scheme even if a Crisis icon is in play.                       |

---

### `ADD_THREAT`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L2880`](../../../src/engine/effects/index.ts#L2880))
- **Description:** Adds threat to the main scheme or a specific side scheme.

> [!NOTE]
> The engine supports targeting specific schemes by `cardCode` (e.g. `'01176'`), `targetInstanceId`, or `target` (`'MAIN_SCHEME'`, `'THIS_SIDE_SCHEME'`). Per RR v1.8 p. 29 ("Targeting"), if a targeted scheme is not in play, the effect logs `scheme.threat.target_missing` and gracefully fizzles without modifying the main scheme.

```json
{
  "effect": "ADD_THREAT",
  "effectParams": {
    "amount": 1,
    "cardCode": "01176"
  }
}
```

> **Conditional threat:** to place threat only in some situations (for example the undefended-attack boost of _Kree Manipulator_ `01178`), gate the step with `IF_CONDITION_MET` and a `condition` such as `UNDEFENDED_ATTACK`; `effectParams` has no `condition` key (see [10. Sequences & Modals](10_sequences_and_prompts.md)).

---

### `ADD_THREAT` (with `perPlayer: true`)
 
 - **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts))
 - **Description:** Adds `amount` (or `amountPerPlayer`) × (number of players) threat when `perPlayer: true`. Supports targeting by `cardCode`, `target` (`THIS_SIDE_SCHEME`, `MAIN_SCHEME`, `SELF`), or defaulting to the source side scheme. Fizzles per RR v1.8 p. 29 if the targeted card is not in play.
 
 ```json
 {
   "effect": "ADD_THREAT",
   "effectParams": {
     "amount": 1,
     "perPlayer": true,
     "target": "THIS_SIDE_SCHEME"
   }
 }
 ```
 
 ---
 
### `PREVENT_DAMAGE` (Damage Interception & Prevention)

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts))
- **Description:** Consumes / prevents incoming attack or effect damage within an `INTERRUPT` window (e.g. `DAMAGE_WOULD_BE_TAKEN`). Prevents `amount` or all incoming damage if `amount` is omitted. Decrements `remainingInterceptedValue` and `damageAmount`. Threat interception is deconflated under `PREVENT_THREAT` per [ADR-0063](../../decisions/0063-deconflate-damage-and-threat-interception-primitives.md).

```json
{
  "effect": "PREVENT_DAMAGE",
  "effectParams": {
    "amount": 3,
    "target": "SELF"
  }
}
```

| Parameter | Type                                    | Required | Default  | Description                                                                                |
| :-------- | :-------------------------------------- | :------- | :------- | :----------------------------------------------------------------------------------------- |
| `amount`  | `number \| 'ALL' \| DynamicValueSource` | No       | `ALL`    | Amount of incoming damage to consume. If omitted or `'ALL'`, consumes all remaining damage.|
| `target`  | `TargetSelector`                        | No       | `"SELF"` | Protected character target.                                                                |

---

### `PREVENT_THREAT` (Threat Interception & Prevention)

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts), [ADR-0063](../../decisions/0063-deconflate-damage-and-threat-interception-primitives.md))
- **Description:** Consumes / reduces impending threat that would be placed on a scheme within an `INTERRUPT` window (`THREAT_WOULD_BE_PLACED`). Prevents `amount` or all impending threat if `amount` is omitted. Decrements `remainingInterceptedValue` and `threatAmount`. Supports dynamic scalar binding (e.g. *Great Responsibility* `01061`), turn limits (e.g. *Jennifer Walters* `01019b`), and partial reduction (e.g. *Emergency* `01085`).

```json
{
  "effect": "PREVENT_THREAT",
  "effectParams": {
    "amount": 1,
    "target": "MAIN_SCHEME"
  }
}
```

| Parameter | Type                                    | Required | Default         | Description                                                                                |
| :-------- | :-------------------------------------- | :------- | :-------------- | :----------------------------------------------------------------------------------------- |
| `amount`  | `number \| 'ALL' \| DynamicValueSource` | No       | `ALL`           | Amount of impending threat to prevent. If omitted or `'ALL'`, prevents all impending threat.|
| `target`  | `TargetSelector`                        | No       | `"MAIN_SCHEME"` | Target scheme where threat would be placed.                                                |
 
 ---
 
 ## 3. Dynamic Value Sources & Numeric Amount Resolution
 
 The engine supports dynamic numeric resolution via `resolveNumericAmount` for parameters such as `amount` in `DEAL_DAMAGE`, `REMOVE_THREAT`, `HEAL_DAMAGE`, `PREVENT_DAMAGE`, `ADD_COUNTERS` and `MODIFY_STAT`. For an activated ability, the results of its cost are part of the formula context: `DISCARDED_CARDS` reads the cards discarded as the cost (_Legal Practice_ `01023`: one threat removed per card discarded) and `RESOURCES_SPENT` the resources paid (_Energy Channel_ `01018`: one counter per energy spent):

```json
{
  "effect": "DEAL_DAMAGE",
  "effectParams": {
    "amount": {
      "from": "INTERCEPTED_VALUE",
      "multiplier": 1,
      "offset": 0
    },
    "target": "SELF_IDENTITY"
  }
}
```

- **`from: "INTERCEPTED_VALUE"`**: Binds the scalar quantity captured from the trigger interception context (`threatAmount`, `damageAmount`, or `interceptedValue`).
- **`multiplier`**: Optional scalar multiplier (defaults to `1`).
- **`offset`**: Optional integer offset (e.g., `-1`, `+2`) to support modifier formulas (defaults to `0`).

---

## 4. Temporary Stat Modifier Auras (`MODIFY_STAT`)

- **Status:** 🟢 `IMPLEMENTED (v1.0)` (ADR-0062 / _Vision_ `01068` / _Lead from the Front_ `01070`)
- **Description:** Pushes a typed `ActiveStatModifier` entry onto `CardInstance.activeStatModifiers` (ally-targeted) or `PlayerState.activeStatModifiers` (hero / all controlled characters). The modifier is aggregated at stat-calculation time by `getEffectiveAllyStats` and `getEffectiveHeroStats`, and is automatically expired at the relevant phase or round transition.

### Targets

| `target` value             | Effect                                                                                           |
| :------------------------- | :----------------------------------------------------------------------------------------------- |
| `"SELF"`                   | Applies to the triggering card instance (typically the ally that activated the ability).         |
| `"ALL_CONTROLLED_CHARACTERS"`| With `atkBonus` / `thwBonus`: applies to the identity AND all allies of one player (the resolving player, or the one chosen with `targetPlayer`). |
| `"TRIGGERING_HERO"`        | Applies to the triggering player's hero identity.                                                |
| `"CHOSEN_ALLY"`            | Applies to a player-chosen ally (currently routes via `SELF` resolution).                        |

### Parameters

| Parameter    | Type                                   | Required | Default   | Description                                              |
| :----------- | :------------------------------------- | :------- | :-------- | :------------------------------------------------------- |
| `stat`       | `"ATK" \| "THW" \| "DEF" \| "REC"`    | Yes      | `"ATK"`   | The stat to modify.                                       |
| `amount`     | `number \| DynamicValueSource`         | Yes      | `1`       | The additive bonus amount, flat or a formula (`CONSTANT` abilities re-evaluate it on every stat read, e.g. _Jessica Jones_ `01059`: `ENTITY_COUNT` of side schemes). |
| `duration`   | `"PHASE" \| "ROUND"`                   | Yes      | `"PHASE"` | Expiry window per RR v1.8 timing boundaries.             |
| `target`     | `TargetSelector`                       | Yes      | `"SELF"`  | Who receives the modifier.                               |
| `atkBonus`   | `number`                               | No       | -         | Shorthand for `stat: "ATK"` when used with `ALL_CONTROLLED_CHARACTERS`. |
| `thwBonus`   | `number`                               | No       | -         | Shorthand for `stat: "THW"` when used with `ALL_CONTROLLED_CHARACTERS`. |
| `targetPlayer` | `"SELF" \| "CHOSEN_PLAYER"`         | No       | `"SELF"`  | `CHOSEN_PLAYER` opens a "Choose a Player" prompt in multiplayer (the chosen player's characters get the bonus) and auto-resolves on the resolving player in solo. |

### Expiry Pipeline

| Duration  | Expiry Trigger                                                                         |
| :-------- | :------------------------------------------------------------------------------------- |
| `"PHASE"` | Cleared at the start of each new player phase (`player-phase.ts`) and at villain phase start (`villain-phase.ts`). |
| `"ROUND"` | Cleared at round upkeep (`round-upkeep.ts`).                                          |

### Example: Vision `01068` — PLAYER_CHOICE → MODIFY_STAT

```json
{
  "effect": "PLAYER_CHOICE",
  "effectParams": {
    "title": "Vision: Density Manipulation",
    "description": "Choose THW or ATK to boost by +2 until the end of the phase:",
    "options": [
      {
        "id": "boost_thw",
        "label": "+2 THW",
        "description": "Vision gets +2 THW until the end of the phase.",
        "effect": "MODIFY_STAT",
        "params": { "stat": "THW", "amount": 2, "duration": "PHASE", "target": "SELF" }
      },
      {
        "id": "boost_atk",
        "label": "+2 ATK",
        "description": "Vision gets +2 ATK until the end of the phase.",
        "effect": "MODIFY_STAT",
        "params": { "stat": "ATK", "amount": 2, "duration": "PHASE", "target": "SELF" }
      }
    ]
  }
}
```

### Example: Lead from the Front `01070` — chosen player's characters

```json
{
  "effect": "MODIFY_STAT",
  "effectParams": {
    "target": "ALL_CONTROLLED_CHARACTERS",
    "targetPlayer": "CHOSEN_PLAYER",
    "atkBonus": 1,
    "thwBonus": 1,
    "duration": "PHASE"
  }
}
```
