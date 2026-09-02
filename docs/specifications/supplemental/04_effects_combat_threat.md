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

- **Status:** � `ROADMAP / SPECIFIED`
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

- **Status:** 🟢 `IMPLEMENTED (v1.0)`
- **Description:**
  - **Retaliate:** Deals X damage back to attacker after receiving an attack.
  - **Quickstrike:** Minion attacks immediately upon engaging hero in Hero form.

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
