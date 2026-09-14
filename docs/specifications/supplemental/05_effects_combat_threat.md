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

| Parameter          | Type             | Required                    | Default          | Description                                                                              |
| :----------------- | :--------------- | :-------------------------- | :--------------- | :--------------------------------------------------------------------------------------- |
| `amount`           | `number`         | Yes (or `amountCalculated`) | -                | Base damage value.                                                                       |
| `amountCalculated` | `string`         | No                          | -                | Dynamic formula token (e.g. `"SUFFERED_DAMAGE"`).                                        |
| `target`           | `TargetSelector` | Yes                         | `"CHOSEN_ENEMY"` | Target recipient.                                                                        |
| `overkill`         | `boolean`        | No                          | `false`          | Excess minion damage spills over to Villain.                                             |
| `piercing`         | `boolean`        | No                          | `false`          | Discards Tough status card before dealing damage.                                        |
| `ranged`           | `boolean`        | No                          | `false`          | Ignores Retaliate keywords on the target.                                                |
| `finisherBonus`    | `number`         | No                          | -                | Bonus damage when ability resolves as final step in a sequence (e.g. *Wakanda Forever!*). |

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
