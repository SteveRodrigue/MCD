# 06. Status Conditions & Resource Economy Primitives

---

## 1. Status Cards & Conditions

### `APPLY_STATUS`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L220`](file:///c:/Users/steve/OneDrive/Documents/Coding/MCD/src/engine/effects/index.ts#L220))
* **Description:** Attaches a `STUNNED`, `CONFUSED`, or `TOUGH` status card to target character.

```json
{
  "effect": "APPLY_STATUS",
  "params": {
    "status": "STUNNED",
    "target": "CHOSEN_ENEMY"
  }
}
```

---

### `TOUGHNESS`
* **Status:** 🟢 `IMPLEMENTED (v1.0)`
* **Description:** Passive keyword ensuring character enters play with a `TOUGH` status card.

---

## 2. Resource Economy & Doublers

### `RESOURCE_GENERATION`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` (*Web-Shooter* `01008`, *Helicarrier* `01092`)
* **Description:** Exhausts card or spends a token to contribute resources to active payment window.

```json
{
  "effect": "RESOURCE_GENERATION",
  "params": {
    "resources": ["wild"],
    "spendCounter": true
  }
}
```

---

### `DOUBLE_RESOURCE`
* **Status:** 🟡 `ROADMAP` (Issue [#22](https://github.com/SteveRodrigue/MCD/issues/22) - *The Power of Aggression/Justice/Leadership/Protection*)
* **Description:** Doubles resource output when spent towards paying for a card matching the specified aspect.

```json
{
  "effect": "DOUBLE_RESOURCE",
  "params": {
    "matchingAspect": "aggression",
    "multiplier": 2
  }
}
```
