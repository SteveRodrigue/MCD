# 03. Ability Costs, Targeting & FilterSchema

> [!NOTE]
> **Status:** 🟢 `IMPLEMENTED (v1.0)`  
> Validated via [`AbilityCostSchema`](../../../src/data/supplemental/schema.ts#L154), [`TargetSelectorSchema`](../../../src/data/supplemental/schema.ts#L80), and [`FilterSchema`](../../../src/data/supplemental/schema.ts#L101).

---

## 1. Ability Costs (`AbilityCost`)

The optional `cost` object defines mandatory prerequisites that must be satisfied and paid before an ability can resolve:

```json
"cost": {
  "exhaustSelf": true,
  "resources": ["energy", "physical"],
  "damageHero": 1,
  "spendTokens": {
    "type": "charge",
    "count": 2
  }
}
```

### Complete Field Matrix: `AbilityCost`

| Field | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| `exhaustSelf` | `boolean` | `true` | Card must be currently ready and exhausts upon activation. |
| `exhaustCard` | `TargetSelector` | `"SELF_IDENTITY"` | A specific target card must exhaust (e.g. exhaust your hero). |
| `resources` | `ResourceType[]` | `["energy", "mental"]` | Specific printed resource types required (`'physical'`, `'energy'`, `'mental'`, `'wild'`). |
| `resourceCost` | `number \| Record<string, number>` | `2` or `{"physical": 1}` | Generic resource payment or typed resource mapping. |
| `damageHero` | `number` | `1` | Direct damage the hero identity must suffer as a cost (e.g. *War Machine*). |
| `discardCard` | `object` | `{"count": 1, "from": "HAND"}` | Card(s) discarded from `"HAND"`, `"DECK"`, or `"PLAY"`. |
| `spendCounters` | `object` | `{"amount": 1, "counterType": "web", "target": "SELF"}` | Decrements counters from the card instance or player identity. |
| `costCheck` | `string` | `"CURRENT_HEALTH < MAX_HEALTH"` | Validation rule ensuring the action produces a legal state mutation. |

---

## 2. Target Selectors (`TargetSelector`)

Defines which game entity is chosen or affected by the ability:

| Target Literal | Target Entity | Multi-Hero Behavior |
| :--- | :--- | :--- |
| `'SELF'` | The host card instance executing the ability (in tableau), or the player identity if executed from an identity event. | Bound to card instance or player. |
| `'SELF_IDENTITY'` | The player identity controlling the card. | Resolves controlling player. |
| `'ACTIVE_PLAYER'` | The player currently taking a turn in Player Phase. | `state.players[state.activePlayerIndex]` |
| `'ALL_PLAYERS'` | Every player currently in the game session. | Iterates all players. |
| `'CHOSEN_PLAYER'` | Prompt user to choose 1 player. | Decision prompt modal. |
| `'VILLAIN'` | The active Villain stage (`getActiveVillain(state)`). | Direct villain reference. |
| `'MAIN_SCHEME'` | The active Main Scheme stage (`getActiveMainScheme(state)`). | Direct main scheme reference. |
| `'SIDE_SCHEME'` | Active Side Schemes in play. | Selects side schemes. |
| `'CHOSEN_SCHEME'` | Player chooses between Main Scheme and any Side Scheme. | Interactive selector. |
| `'CHOSEN_ENEMY'` | Player chooses between the Villain and any Minion in play. | Interactive selector. |
| `'ALL_ENEMIES'` | The active Villain and all minions across all player play areas. | Batch combat target. |
| `'ENGAGED_ENEMIES'` | The active Villain and each minion engaged specifically with the resolving player. | Batch local target. |
| `'ENGAGED_MINIONS'` | All minions engaged specifically with the resolving player (excludes Villain). | Player minion zone. |
| `'CHOSEN_MINION'` | Player chooses 1 minion card currently in play across any player. | Interactive selector. |
| `'CHOSEN_ENGAGED_MINION'` | Player chooses 1 minion engaged specifically with the resolving player. | Interactive selector. |
| `'ALL_MINIONS'` | All minions currently in play across all player play areas (excludes Villain). | Batch minion target. |
| `'CHOSEN_ALLY'` | Player chooses 1 ally card currently in play. | Interactive selector. |
| `'ALL_ALLIES'` | All allies under the resolving player's control (or across play areas). | Batch ally target. |
| `'CHOSEN_CHARACTER'` | Player chooses between identity and any ally currently in play. | Interactive selector. |
| `'ALL_CHARACTERS'` | The player identity and all allies currently in play. | Batch character target. |
| `'PREVIOUS_TARGET'` | Re-uses target from previous ability step or the triggering combat context. | Step result or event entity. |

---

## 3. Universal Card Filter (`UniversalCardFilterSchema`)

Card filtering across searching, targeting, discarding, and dynamic counters is strictly unified under the **Universal Card Filter Architecture** (ADR-0046).

> [!IMPORTANT]
> **Authoritative Specification:**  
> For complete reference documentation, criteria breakdown (`traits`, `types`, `aspects`, `codes`, `cost`, `resourceIcons`), and boolean combinators (`all`, `any`, `none`), consult the dedicated specification:  
> 👉 [**04. Universal Card Filter Specification**](./04_universal_card_filter.md)
