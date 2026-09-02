# 06. Status Conditions & Resource Economy Primitives

---

## 1. Status Cards & Conditions

### `ADD_STATUS`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L1180`](../../../src/engine/effects/index.ts#L1180))
- **Description:** Attaches a `STUNNED`, `CONFUSED`, or `TOUGH` status card to the target character. `target` defaults to `VILLAIN`; Stalwart immunity and Steady thresholds are enforced during application.

```json
{
  "effect": "ADD_STATUS",
  "params": {
    "status": "STUNNED",
    "target": "CHOSEN_ENEMY"
  }
}
```

---

### `Toughness` (keyword)

- **Status:** 🟢 `IMPLEMENTED (v1.0)`
- **Description:** Passive keyword ensuring a character enters play with a `TOUGH` status card. Declared via the `hasKeyword` filter vocabulary, not as an effect primitive.

---

## 2. Resource Economy & Doublers

### `GENERATE_RESOURCE`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L1123`](../../../src/engine/effects/index.ts#L1123) / _Web-Shooter_ `01008`, _Helicarrier_ `01092`)
- **Description:** Contributes resources to the active payment window. `resource` defaults to `"wild"` and `amount` defaults to `1`.

```json
{
  "effect": "GENERATE_RESOURCE",
  "params": {
    "resource": "wild",
    "amount": 1
  }
}
```

---

### `DOUBLE_RESOURCE_FOR_ASPECT`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` (Issue [#22](https://github.com/SteveRodrigue/MCD/issues/22) - _The Power of Aggression/Justice/Leadership/Protection_)
- **Description:** Doubles the card's resource output when it is spent towards paying for a card matching `aspect`. Resolved in the payment window ([`legality-checker.ts:L711`](../../../src/engine/pipeline/legality-checker.ts#L711) and `CardPaymentModal.tsx`), not through the `switch (step.effect)` executor.
- **Declared by:** 4 cards in `core.json` under `"timing": "RESOURCE"`.

```json
{
  "effect": "DOUBLE_RESOURCE_FOR_ASPECT",
  "params": {
    "aspect": "aggression"
  }
}
```
