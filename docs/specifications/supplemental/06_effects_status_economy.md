# 06. Status Conditions, Card Orientation & Resource Economy Primitives

---

## 1. Status Cards & Conditions

### `ADD_STATUS`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts))
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

## 2. Card Orientation & Ready States (`EXHAUST`, `READY`)

Universal effect primitives to manipulate the orientation (exhausted vs. ready) of cards, identities, allies, characters, minions, and villains per RR v1.8 (Issue [#65](https://github.com/SteveRodrigue/MCD/issues/65)).

### `EXHAUST`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts) / Issue [#65](https://github.com/SteveRodrigue/MCD/issues/65))
- **Description:** Rotates target entity 90 degrees into the exhausted state per RR v1.8 p. 13. A card that is already exhausted cannot be exhausted again. Emits onomatopoeia `'EXHAUSTED!'`.
- **Target Resolution:**
  - `'SELF'`: Exhausts the host card instance in the player's tableau (`player.tableau`). If executed from an identity event, exhausts player identity (`player.exhausted = true`).
  - `'SELF_IDENTITY'` / `'ACTIVE_PLAYER'`: Exhausts the player identity.
  - `'CHOSEN_ALLY'`: Exhausts the specified or targeted ally in `player.allies`.
  - `'ALL_ALLIES'`: Exhausts all allies in the player's control.
  - `'CHOSEN_CHARACTER'`: Exhausts chosen identity or ally.
  - `'ALL_CHARACTERS'`: Exhausts identity and all allies in play.
  - `'VILLAIN'`: Exhausts the active villain (`state.villain.exhausted = true`).
  - `'CHOSEN_MINION'` / `'ALL_MINIONS'`: Exhausts targeted or all engaged minions.

```json
{
  "effect": "EXHAUST",
  "params": {
    "target": "SELF_IDENTITY"
  }
}
```

---

### `READY`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts) / Issue [#65](https://github.com/SteveRodrigue/MCD/issues/65))
- **Description:** Rotates an exhausted target upright into the ready state per RR v1.8 p. 23. A card that is already ready cannot be readied again. Emits onomatopoeia `'READY!'`.
- **Target Resolution:**
  - `'SELF'`: Readies the host card instance in `player.tableau` (e.g. upgrades/supports). If resolved from an identity event, readies player identity.
  - `'SELF_IDENTITY'` / `'ACTIVE_PLAYER'`: Readies the player identity (e.g. *One-Two Punch* `01024`, *Arc Reactor* `01035`, *Indomitable* `01082`, *Tenacity* `01093`).
  - `'CHOSEN_ALLY'`: Readies the specified or targeted ally (e.g. *Get Ready* `01069`).
  - `'ALL_ALLIES'`: Readies all allies under the player's control.
  - `'CHOSEN_CHARACTER'`: Readies chosen identity or ally.
  - `'ALL_CHARACTERS'`: Readies identity and all allies in play.
  - `'CHOSEN_MINION'` / `'ALL_MINIONS'`: Readies targeted or all minions.

```json
{
  "effect": "READY",
  "params": {
    "target": "CHOSEN_ALLY"
  }
}
```

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `target` | `TargetSelector` | No | Target entity to orient (`SELF_IDENTITY`, `SELF`, `CHOSEN_ALLY`, `ALL_ALLIES`, `CHOSEN_CHARACTER`, `ALL_CHARACTERS`, `VILLAIN`, `CHOSEN_MINION`, `ALL_MINIONS`). Defaults to `'SELF_IDENTITY'`. |
| `filter` | `string \| FilterSchema` | No | Optional filter expression applied to eligible targets (e.g. `trait:Avenger`). |

---

### 🧭 Decision Guide: Ability Cost Exhaust vs. Effect Step Exhaust / Ready

| Feature | Ability Cost (`cost.exhaustSelf` / `cost.exhaustCard`) | Effect Step (`EXHAUST` / `READY`) |
| :--- | :--- | :--- |
| **Rules Reference** | **"Cost" (p. 8)** | **"Exhaust" (p. 13)** & **"Ready" (p. 23)** |
| **Timing Location** | **Before arrow `→`** (Prerequisite payment) | **After arrow `→`** (Resolution effect payoff) |
| **Engine Reducer** | `cost-engine.ts` / `legality-checker.ts` | `executeEffect()` in `effects/index.ts` |
| **Card Editor UI** | **"Exhaust Host Card"** checkbox in Cost Section | **`EXHAUST` / `READY`** primitive in Resolution Steps Section |
| **Example Cards** | *Web-Shooter* (`01008`), *Helicarrier* (`01092`), *Stark Tower* (`01034`) | *Arc Reactor* (`01035`), *One-Two Punch* (`01024`), *Get Ready* (`01069`), *Exhaustion* (`01191`) |

- **Rule of Thumb:** If the card must exhaust *in order to pay for an ability*, declare `"cost": { "exhaustSelf": true }`. If the card readies or exhausts *as the resulting effect or consequence*, declare `"effect": "READY"` or `"effect": "EXHAUST"`.

---

## 3. Resource Economy & Doublers

### `GENERATE_RESOURCE`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts) / _Web-Shooter_ `01008`, _Helicarrier_ `01092`)
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
- **Description:** Doubles the card's resource output when it is spent towards paying for a card matching `aspect`. Resolved in the payment window ([`legality-checker.ts`](../../../src/engine/pipeline/legality-checker.ts) and `CardPaymentModal.tsx`), not through the `switch (step.effect)` executor.
- **Declared by:** 4 cards in `core.json` under `"timing": "RESOURCE"`.

```json
{
  "effect": "DOUBLE_RESOURCE_FOR_ASPECT",
  "params": {
    "aspect": "aggression"
  }
}
```
