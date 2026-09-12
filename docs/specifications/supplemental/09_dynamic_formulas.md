# 08. Dynamic Formulas & Mathematical Expressions

> [!NOTE]
> **Status:** 🟢 `ACTIVE / SPECIFIED` ([ADR-0049](../../decisions/0049-composable-value-transformers-and-event-interception.md), [ADR-0052](../../decisions/0052-centralized-dynamic-formula-and-state-value-evaluator-engine.md), Issue [#36](https://github.com/SteveRodrigue/MCD/issues/36), Issue [#89](https://github.com/SteveRodrigue/MCD/issues/89), Issue [#90](https://github.com/SteveRodrigue/MCD/issues/90) - *Gamma Slam* `01021`, *Energy Channel* `01019`, *Counter-Punch* `01077`, *Great Responsibility* `01061`)

---

## 1. Canonical Declarative Dynamic Value Sources (`DynamicValueSourceSchema`)

Under **ADR-0049** and **ADR-0052**, the engine standardizes dynamic values across numeric parameters (`amount`, `count`, `lookCount`, `takeCount`) using strongly-typed `DynamicValueSource` resolver objects.

Ad-hoc string tokens (`amountFormula`) are completely retired in favor of this single unified schema:

```json
{
  "from": "STAT_VALUE",
  "stat": "SUFFERED_DAMAGE",
  "multiplier": 1,
  "offset": 0,
  "clamp": {
    "max": 15
  }
}
```

### Supported Value Sources (`from`)

| Value Source (`from`) | Evaluated Quantity | Typical Context / Trigger | Example Card Declarations |
| :--- | :--- | :--- | :--- |
| `ENTITY_COUNT` | Count of in-play cards matching an optional declarative `filter: UniversalCardFilter`. | Board state inspection | *Jessica Jones* (`01059` side schemes), *Iron Man* (`01029a` Tech upgrades) |
| `COUNTERS` | Counters on card or identity specified by `counterType` and `target`. | Card counters | *Energy Channel* (`01019`), *Groot* |
| `STAT_VALUE` | Identity, ally, enemy, or scheme stat specified by `stat` (`SUFFERED_DAMAGE`, `ATTACK`, `THWART`, `DEFENSE`, `RECOVERY`, `THREAT`, `DAMAGE`). | Character/scheme attribute scaling | *Gamma Slam* (`01021`), *Counter-Punch* (`01077`) |
| `CARD_ATTRIBUTE` | Numeric attribute of target card specified by `attribute` (`BOOST_ICONS`, `PRINTED_RESOURCES`, `PRINTED_COST`). | Card inspection | Boost/resource scaling |
| `INTERCEPTED_VALUE` | Scalar quantity captured from trigger window (`threatAmount`, `damageAmount`, or `interceptedValue`). | `THREAT_WOULD_BE_PLACED`, `TAKE_ATTACK_DAMAGE`, `DAMAGE_WOULD_BE_DEALT` | *Great Responsibility* (`01061`), *Emergency* (`01085`) |
| `PREVIOUS_RESULT` | The numeric `value` returned by the preceding ability step (`previousResult.value`). | Sequential steps (`steps: []`) | Multi-step chains converting one count to another |
| `DISCARDED_COUNT` | Number of cards discarded by previous or current step. | Discard steps / cost payment | *Legal Practice* (`01022`), *Repulsor Blast* (`01031`) |

---

## 2. Modifiers, Clamping & Rules Reference (RR v1.8) Calculations

Per **RR v1.8 p. 11 ("Modifiers", "Calculation")** and **p. 31 ("Variable Numbers", "X")**:
1. All dynamic values are calculated at the moment of ability resolution.
2. Fractions are rounded down (`Math.floor`).
3. Quantities cannot be negative (`Math.max(0, ...)`).
4. Limits and ceilings ("to a maximum of X") are enforced via `clamp.max`.

### Modifier Fields:
- `multiplier`: Number multiplier applied to the base resolved quantity (default: `1`).
- `offset`: Integer offset added to the multiplied quantity (e.g. `-1`, `+2`) (default: `0`).
- `clamp.min`: Minimum lower bound (default: `0`).
- `clamp.max`: Maximum upper bound (e.g. `15` for *Gamma Slam*, `10` for *Energy Channel*).

### Mathematical Formula:
$$\text{Final Amount} = \max\Big(0, \operatorname{clamp}\big(\lfloor \text{Base Value} \times \text{multiplier} + \text{offset} \rfloor, \, \text{clamp.min}, \, \text{clamp.max}\big)\Big)$$

---

## 3. Concrete Card Examples

### A. Suffered Damage Clamped to 15 (*Gamma Slam* `01021`)
```json
{
  "effect": "DEAL_DAMAGE",
  "params": {
    "target": "ENEMY",
    "amount": {
      "from": "STAT_VALUE",
      "stat": "SUFFERED_DAMAGE",
      "clamp": {
        "max": 15
      }
    }
  }
}
```

### B. Energy Counters Multiplied by 2 Clamped to 10 (*Energy Channel* `01019`)
```json
{
  "effect": "DEAL_DAMAGE",
  "params": {
    "target": "CHOSEN_ENEMY",
    "amount": {
      "from": "COUNTERS",
      "counterType": "energy",
      "multiplier": 2,
      "clamp": {
        "max": 10
      }
    }
  }
}
```

### C. Hero ATK Dynamic Damage (*Counter-Punch* `01077`)
```json
{
  "effect": "DEAL_DAMAGE",
  "params": {
    "target": "ATTACKING_ENEMY",
    "amount": {
      "from": "STAT_VALUE",
      "stat": "ATTACK"
    }
  }
}
```

### D. Taking Intercepted Threat as Damage (*Great Responsibility* `01061`)
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
