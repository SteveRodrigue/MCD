# 04. Combat, Damage & Threat Effect Primitives

---

## 1. Combat & Damage Primitives

### `DEAL_DAMAGE`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L43`](../../../src/engine/effects/index.ts#L43))
- **Description:** Deals flat or dynamically calculated damage to target enemy or character. Handles Tough status removal, overkill, and character defeat.

```json
{
  "effect": "DEAL_DAMAGE",
  "params": {
    "amount": 8,
    "target": "CHOSEN_ENEMY",
    "overkill": true,
    "piercing": false,
    "ranged": false
  }
}
```

| Parameter          | Type                           | Required | Default          | Description                                                                              |
| :----------------- | :----------------------------- | :------- | :--------------- | :--------------------------------------------------------------------------------------- |
| `amount`           | `number \| DynamicValueSource` | Yes      | -                | Base damage value (flat integer or dynamic formula).                                     |
| `target`           | `TargetSelector`               | Yes      | `"CHOSEN_ENEMY"` | Target recipient.                                                                        |
| `overkill`         | `boolean`                      | No       | `false`          | Excess minion damage spills over to Villain.                                             |
| `piercing`         | `boolean`                      | No       | `false`          | Discards Tough status card before dealing damage.                                        |
| `ranged`           | `boolean`                      | No       | `false`          | Ignores Retaliate keywords on the target.                                                |
| `finisherBonus`    | `number`                       | No       | -                | Bonus damage when ability resolves as final step in a sequence (e.g. *Wakanda Forever!*). |
| `dynamicBonus`     | `number \| DynamicValueSource` | No       | -                | Dynamic bonus damage added to amount (e.g. *Supersonic Punch* `01032`).                  |

---

### `DEAL_DAMAGE_SPLIT`

- **Status:** 🟡 `ROADMAP / SPECIFIED`
- **Description:** Divides a pool of damage among multiple eligible targets.

> [!NOTE]
> No `case "DEAL_DAMAGE_SPLIT"` exists in `src/engine/effects/index.ts` and no card declares it.
> Use `DEAL_DAMAGE` with `target: "ALL_ENEMIES"` for undivided area damage.

```json
{
  "effect": "DEAL_DAMAGE_SPLIT",
  "params": {
    "totalDamage": 4,
    "target": "ALL_ENEMIES"
  }
}
```

---

### `RETALIATE` / `QUICKSTRIKE`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([ADR-0054](../../decisions/0054-parameterized-keyword-stacking-and-retaliate-value-accumulation-engine.md))
- **Description:**
  - **Retaliate:** Deals X damage back to attacker after receiving an attack (RR v1.8 p. 24). Values from multiple active instances (base card, attachments, upgrades) are added together.
  - **Quickstrike:** Minion attacks immediately upon engaging hero in Hero form.

```json
{
  "effect": "GRANT_KEYWORD",
  "params": {
    "keyword": "Retaliate",
    "amount": 1
  }
}
```

---

### `TRANSFER_DAMAGE`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts))
- **Description:** Moves / transfers damage from one character (e.g. hero) to an enemy (Villain or engaged minion). Heals the source and deals direct damage to the target.

```json
{
  "effect": "TRANSFER_DAMAGE",
  "params": {
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
- **Description:** Removes threat from Main Scheme, Side Scheme, or chosen scheme. Enforces Crisis keyword restrictions.

```json
{
  "effect": "REMOVE_THREAT",
  "params": {
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
| `aerialAllSchemes` | `boolean`                      | No       | `false`         | Removes threat from all active schemes if character has Aerial.                             |
| `crisisIgnore`     | `boolean`                      | No       | `false`         | Removes threat from Main Scheme even if Crisis icon is active.                              |

---

### `ADD_THREAT`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L2880`](../../../src/engine/effects/index.ts#L2880))
- **Description:** Adds threat to the main scheme or a specific side scheme.

> [!NOTE]
> The engine supports targeting specific schemes by `cardCode` (e.g. `'01176'`), `targetInstanceId`, or `target` (`'MAIN_SCHEME'`, `'THIS_SIDE_SCHEME'`). Per RR v1.8 p. 29 ("Targeting"), if a targeted scheme is not in play, the effect logs `scheme.threat.target_missing` and gracefully fizzles without modifying the main scheme.

```json
{
  "effect": "ADD_THREAT",
  "params": {
    "amount": 1,
    "cardCode": "01176"
  }
}
```

---

### `ADD_THREAT` (with `perPlayer: true`)
 
 - **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts))
 - **Description:** Adds `amount` (or `amountPerPlayer`) × (number of players) threat when `perPlayer: true`. Supports targeting by `cardCode`, `target` (`THIS_SIDE_SCHEME`, `MAIN_SCHEME`, `SELF`), or defaulting to the source side scheme. Fizzles per RR v1.8 p. 29 if the targeted card is not in play.
 
 ```json
 {
   "effect": "ADD_THREAT",
   "params": {
     "amount": 1,
     "perPlayer": true,
     "target": "THIS_SIDE_SCHEME"
   }
 }
 ```
 
 ---
 
 ### `PLACE_THREAT_PER_SIDE_SCHEME`
 
 - **Status:** 🟢 `IMPLEMENTED (v1.0)` (_Masterplan_ `01192`)
 - **Description:** Places X threat on each active side scheme; if none exist, mills encounter deck until a side scheme is found and puts it into play.
 
 ```json
 {
   "effect": "PLACE_THREAT_PER_SIDE_SCHEME",
   "params": {
     "amount": 4
   }
 }
 ```
 
 ---
 
 ### `PREVENT_DAMAGE` (Interception & Prevention)
 
 - **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts))
 - **Description:** Consumes / prevents incoming damage (or threat) within an `INTERRUPT` window (e.g. `DAMAGE_WOULD_BE_TAKEN`, `THREAT_WOULD_BE_PLACED`). Prevents `amount` or all incoming value if `amount` is omitted. Decrements `remainingInterceptedValue`, `threatAmount`, and `damageAmount`.
 
 ```json
 {
   "effect": "PREVENT_DAMAGE",
   "params": {
     "amount": 1
   }
 }
 ```
 
 | Parameter | Type                                          | Required | Default | Description                                                                                  |
 | :-------- | :-------------------------------------------- | :------- | :------ | :------------------------------------------------------------------------------------------- |
 | `amount`  | `number \| { from: "INTERCEPTED_VALUE", ...}` | No       | `All`   | Amount of incoming event value to consume. If omitted, consumes all remaining value to zero. |
 
 ---
 
 ## 3. Dynamic Value Sources & Numeric Amount Resolution
 
 The engine supports dynamic numeric resolution via `resolveNumericAmount` for parameters such as `amount` in `DEAL_DAMAGE`, `REMOVE_THREAT`, `HEAL_DAMAGE`, and `PREVENT_DAMAGE`:

```json
{
  "effect": "DEAL_DAMAGE",
  "params": {
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
- **Description:** Pushes a typed `ActiveStatModifier` entry onto `CardInstance.activeStatModifiers` (ally-targeted) or `PlayerState.activeStatModifiers` (hero / all-friendly-characters). The modifier is aggregated at stat-calculation time by `getEffectiveAllyStats` and `getEffectiveHeroStats`, and is automatically expired at the relevant phase or round transition.

### Targets

| `target` value             | Effect                                                                                           |
| :------------------------- | :----------------------------------------------------------------------------------------------- |
| `"SELF"`                   | Applies to the triggering card instance (typically the ally that activated the ability).         |
| `"ALL_FRIENDLY_CHARACTERS"`| Applies to the triggering player's hero identity AND all allied characters simultaneously.       |
| `"TRIGGERING_HERO"`        | Applies to the triggering player's hero identity.                                                |
| `"CHOSEN_ALLY"`            | Applies to a player-chosen ally (currently routes via `SELF` resolution).                        |

### Parameters

| Parameter    | Type                                   | Required | Default   | Description                                              |
| :----------- | :------------------------------------- | :------- | :-------- | :------------------------------------------------------- |
| `stat`       | `"ATK" \| "THW" \| "DEF" \| "REC"`    | Yes      | `"ATK"`   | The stat to modify.                                       |
| `amount`     | `number`                               | Yes      | `1`       | The additive bonus amount.                               |
| `duration`   | `"PHASE" \| "ROUND"`                   | Yes      | `"PHASE"` | Expiry window per RR v1.8 timing boundaries.             |
| `target`     | `TargetSelector`                       | Yes      | `"SELF"`  | Who receives the modifier.                               |
| `atkBonus`   | `number`                               | No       | -         | Shorthand for `stat: "ATK"` when used with `ALL_FRIENDLY_CHARACTERS`. |
| `thwBonus`   | `number`                               | No       | -         | Shorthand for `stat: "THW"` when used with `ALL_FRIENDLY_CHARACTERS`. |

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

### Example: Lead from the Front `01070` — ALL_FRIENDLY_CHARACTERS buff

```json
{
  "effect": "MODIFY_STAT",
  "effectParams": {
    "target": "ALL_FRIENDLY_CHARACTERS",
    "atkBonus": 1,
    "thwBonus": 1,
    "duration": "PHASE"
  }
}
```
