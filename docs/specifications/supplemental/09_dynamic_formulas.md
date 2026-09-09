# 08. Dynamic Formulas & Mathematical Expressions

> [!NOTE]
> **Status:** 🟢 `ACTIVE / SPECIFIED` ([ADR-0049](../../decisions/0049-composable-value-transformers-and-event-interception.md), Issue [#89](https://github.com/SteveRodrigue/MCD/issues/89), Issue [#90](https://github.com/SteveRodrigue/MCD/issues/90) - *Gamma Slam* `01021`, *Great Responsibility* `01061`, *Emergency* `01085`)

---

## 1. Declarative Dynamic Value Sources (`DynamicValueSourceSchema`)

Under **ADR-0049**, the engine standardizes dynamic values across numeric parameters (`amount`, `count`, `lookCount`, `takeCount`) using strongly-typed `DynamicValueSource` resolver objects:

```json
{
  "from": "INTERCEPTED_VALUE",
  "multiplier": 1,
  "offset": 0
}
```

### Supported Value Sources (`from`)

| Value Source (`from`) | Evaluated Quantity | Typical Context / Trigger | Example Card Declarations |
| :--- | :--- | :--- | :--- |
| `INTERCEPTED_VALUE` | Scalar quantity captured from trigger window (`threatAmount`, `damageAmount`, or `interceptedValue`). | `THREAT_WOULD_BE_PLACED`, `TAKE_ATTACK_DAMAGE`, `DAMAGE_WOULD_BE_DEALT` | *Great Responsibility* (`01061`), *Not My Responsibility* (`44022`) |
| `PREVIOUS_RESULT` | The numeric `value` returned by the preceding ability step (`previousResult.value`). | Sequential steps (`steps: []`) | Multi-step chains converting one count to another |
| `DISCARDED_COUNT` | Number of cards discarded by previous or current step. | Discard steps / cost payment | *Legal Practice* (`01022`), *Repulsor Blast* (`01031`) |
| `ENTITY_COUNT` | Count of in-play cards matching an optional declarative `filter: UniversalCardFilter`. | Board state inspection | *Jessica Jones* (`01059` side schemes), *Energy Daggers* |
| `STAT_VALUE` | Identity or character stat/attribute specified by `stat` (e.g. `"SUFFERED_DAMAGE"`, `"ATTACK"`, `"THWART"`). | Character attribute scaling | *Gamma Slam* (`01021`) |

### Optional Modifier Parameters

- `multiplier`: Number multiplier applied to the base resolved quantity (default: `1`).
- `offset`: Integer offset added to the multiplied quantity (e.g. `-1`, `+2`) to formulate modifiers (default: `0`).
- `stat`: Name of the character attribute when `from: "STAT_VALUE"` is used.
- `filter`: Declarative `UniversalCardFilter` when counting entities (`from: "ENTITY_COUNT"`) or discarded cards (`from: "DISCARDED_COUNT"`).

### Example: Taking Intercepted Threat as Damage (*Great Responsibility* `01061`)

```json
{
  "effect": "DEAL_DAMAGE",
  "params": {
    "target": "SELF_IDENTITY",
    "amount": {
      "from": "INTERCEPTED_VALUE"
    }
  }
}
```

---

## 2. Legacy Dynamic Formula Tokens (`amountFormula`)

For existing cards whose numeric effects scale based on live game state:

```json
{
  "effect": "DEAL_DAMAGE",
  "params": {
    "amountFormula": "SUFFERED_DAMAGE",
    "max": 15,
    "target": "ENEMY"
  }
}
```

| Formula Name | Evaluated State Expression | Example Card |
| :--- | :--- | :--- |
| `SUFFERED_DAMAGE` | `Math.max(0, getEffectiveMaxHealth(player, state) - player.health)` | *Gamma Slam* (`01021`) |
| `HERO_ATK` | `getEffectiveHeroStats(state, player).attack` | Aggression events |

### Optional Ceiling Parameter (`max`)
The `max` parameter is optional and reusable across abilities. When specified, damage is clamped to `Math.min(max, damageSustained)`. When omitted, damage scales uncapped.

---

## 3. Clamping & Multipliers

```json
"params": {
  "amountCalculated": "SUFFERED_DAMAGE",
  "multiplier": 1,
  "clamp": {
    "min": 1,
    "max": 15
  }
}
```

* `multiplier`: Optional multiplier applied to computed token (default `1`).
* `clamp.min`: Minimum lower bound.
* `clamp.max`: Maximum upper bound.

