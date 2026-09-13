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

| Parameter          | Type             | Required                    | Default          | Description                                       |
| :----------------- | :--------------- | :-------------------------- | :--------------- | :------------------------------------------------ |
| `amount`           | `number`         | Yes (or `amountCalculated`) | -                | Base damage value.                                |
| `amountCalculated` | `string`         | No                          | -                | Dynamic formula token (e.g. `"SUFFERED_DAMAGE"`). |
| `target`           | `TargetSelector` | Yes                         | `"CHOSEN_ENEMY"` | Target recipient.                                 |
| `overkill`         | `boolean`        | No                          | `false`          | Excess minion damage spills over to Villain.      |
| `piercing`         | `boolean`        | No                          | `false`          | Discards Tough status card before dealing damage. |
| `ranged`           | `boolean`        | No                          | `false`          | Ignores Retaliate keywords on the target.         |

---

### `DEAL_DAMAGE_SPLIT`

- **Status:** 🟡 `ROADMAP / SPECIFIED`
- **Description:** Divides a pool of damage among multiple eligible targets.

> [!NOTE]
> No `case "DEAL_DAMAGE_SPLIT"` exists in `src/engine/effects/index.ts` and no card declares it.
> Use `DEAL_DAMAGE_ALL_ENEMIES` for undivided area damage.

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

---

### `ADD_THREAT`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L2569`](../../../src/engine/effects/index.ts#L2569))
- **Description:** Adds threat to the main scheme.

> [!NOTE]
> The engine accepts a `target` param and records it in the action log, but the current
> implementation always adds the threat to `state.mainScheme`.

```json
{
  "effect": "ADD_THREAT",
  "params": {
    "amount": 1,
    "target": "MAIN_SCHEME"
  }
}
```

---

### `ADD_THREAT_PER_PLAYER`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L1498`](../../../src/engine/effects/index.ts#L1498))
- **Description:** Adds `amount` × (number of players) threat. `target` defaults to `THIS_SIDE_SCHEME`, resolved from the source card instance.

```json
{
  "effect": "ADD_THREAT_PER_PLAYER",
  "params": {
    "amount": 1,
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

### `CONSUME_INTERCEPTED_EVENT`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts))
- **Description:** Consumes a scalar amount (or all if `amount` is omitted) of an active intercepted event (e.g. `TAKE_ATTACK_DAMAGE`, `THREAT_WOULD_BE_PLACED`) within an `INTERRUPT` window. Decrements `remainingInterceptedValue`, `threatAmount`, and `damageAmount` across sequential ability execution steps.

```json
{
  "effect": "CONSUME_INTERCEPTED_EVENT",
  "params": {
    "amount": 1
  }
}
```

| Parameter | Type                                         | Required | Default | Description                                                                                    |
| :-------- | :------------------------------------------- | :------- | :------ | :--------------------------------------------------------------------------------------------- |
| `amount`  | `number \| { from: "INTERCEPTED_VALUE", ...}` | No       | `All`   | Amount of incoming event value to consume. If omitted, consumes all remaining value to zero. |

---

## 3. Dynamic Value Sources & Numeric Amount Resolution

The engine supports dynamic numeric resolution via `resolveNumericAmount` for parameters such as `amount` in `DEAL_DAMAGE`, `REMOVE_THREAT`, `HEAL_DAMAGE`, and `CONSUME_INTERCEPTED_EVENT`:

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


