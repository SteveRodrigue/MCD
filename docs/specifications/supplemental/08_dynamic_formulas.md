# 08. Dynamic Formulas & Mathematical Expressions

> [!NOTE]
> **Status:** 🟡 `ROADMAP / IN PROGRESS` (Issue [#5](https://github.com/SteveRodrigue/MCD/issues/5) - *Gamma Slam* `01021`, *Jessica Jones* `01059`)

---

## 1. Dynamic Formula Tokens (`amountCalculated`)

For cards whose numeric effects scale based on live game state, the `amountCalculated` string parameter declares the mathematical expression:

```json
{
  "effect": "DEAL_DAMAGE",
  "params": {
    "amountCalculated": "SUFFERED_DAMAGE",
    "clamp": {
      "max": 15
    },
    "target": "CHOSEN_ENEMY"
  }
}
```

---

## 2. Standard State Tokens

| Token Name | Evaluated State Expression | Example Card |
| :--- | :--- | :--- |
| `PLAYER_MAX_HEALTH` | `player.maxHealth` | Base hero health reference |
| `PLAYER_CURRENT_HEALTH`| `player.health` | Live player health |
| `SUFFERED_DAMAGE` | `player.maxHealth - player.health` | *Gamma Slam* (`01021`) |
| `SIDE_SCHEMES_IN_PLAY` | `state.sideSchemes.length` | *Jessica Jones* (`01059`) |
| `THREAT_ON_SCHEME` | `scheme.threat` | *Explosion* (`01111`) |
| `TABLEAU_COUNT(filter)`| `player.tableau.filter(filter).length` | *Iron Man* (`01029a`) |

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
