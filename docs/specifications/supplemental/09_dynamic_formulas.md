# 08. Dynamic Formulas & Mathematical Expressions

> [!NOTE]
> **Status:** 🟢 `ACTIVE / SPECIFIED` (Issue [#5](https://github.com/SteveRodrigue/MCD/issues/5) - *Gamma Slam* `01021`)

---

## 1. Dynamic Formula Tokens (`amountFormula`)

For cards whose numeric effects scale based on live game state, the `amountFormula` parameter declares the mathematical expression:

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

---

## 2. Standard State Formulas

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
