# 03. Ability Costs, Targeting & FilterSchema

> [!NOTE]
> **Status:** 🟢 `IMPLEMENTED (v1.0)`  
> Validated via [`AbilityCostSchema`](file:///c:/Users/steve/OneDrive/Documents/Coding/MCD/src/data/supplemental/schema.ts#L154), [`TargetSelectorSchema`](file:///c:/Users/steve/OneDrive/Documents/Coding/MCD/src/data/supplemental/schema.ts#L80), and [`FilterSchema`](file:///c:/Users/steve/OneDrive/Documents/Coding/MCD/src/data/supplemental/schema.ts#L101).

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
| `spendTokens` | `object` | `{"type": "counter", "count": 1}` | Decrements counters/tokens from the card. |
| `costCheck` | `string` | `"CURRENT_HEALTH < MAX_HEALTH"` | Validation rule ensuring the action produces a legal state mutation. |

---

## 2. Target Selectors (`TargetSelector`)

Defines which game entity is chosen or affected by the ability:

| Target Literal | Target Entity | Multi-Hero Behavior |
| :--- | :--- | :--- |
| `'SELF'` | The card instance executing the ability. | Bound to card instance. |
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
| `'ENGAGED_MINIONS'` | All minions engaged specifically with the resolving player. | Player minion zone. |
| `'CHOSEN_ALLY'` | Player chooses 1 ally card currently in play. | Interactive selector. |

---

## 3. Exhaustive Filter Specification (`FilterSchema`)

The `FilterSchema` is used across search effects, dynamic counters, and targeting filters:

```typescript
export interface FilterSchema {
  type?: 'hero' | 'alter_ego' | 'ally' | 'upgrade' | 'support' | 'event' | 'resource' | 'minion' | 'villain' | 'main_scheme' | 'side_scheme' | 'treachery' | 'attachment' | 'obligation' | 'environment';
  trait?: string;
  aspect?: 'aggression' | 'justice' | 'leadership' | 'protection' | 'basic' | 'encounter';
  zone?: 'tableau' | 'hand' | 'deck' | 'discard' | 'setAside' | 'engaged';
  isUnique?: boolean;
  costMin?: number;
  costMax?: number;
  hasKeyword?: 'Guard' | 'Overkill' | 'Quickstrike' | 'Ranged' | 'Retaliate' | 'Toughness' | 'Crisis' | 'Hazard' | 'Acceleration';
}
```

### Field Definitions

| Field | Type | Allowed Values / Format | Description |
| :--- | :--- | :--- | :--- |
| `type` | `enum` | `'hero'`, `'alter_ego'`, `'ally'`, `'upgrade'`, `'support'`, `'event'`, `'resource'`, `'minion'`, `'villain'`, `'main_scheme'`, `'side_scheme'`, `'treachery'`, `'attachment'`, `'obligation'`, `'environment'` | Filters by card type code. |
| `trait` | `string` | Case-sensitive string (e.g. `"Tech"`, `"Avenger"`, `"Aerial"`, `"Weapon"`, `"Gamma"`) | Matches traits defined on card. |
| `aspect` | `enum` | `'aggression'`, `'justice'`, `'leadership'`, `'protection'`, `'basic'`, `'encounter'` | Filters by card faction / aspect. |
| `zone` | `enum` | `'tableau'`, `'hand'`, `'deck'`, `'discard'`, `'setAside'`, `'engaged'` | Restricts evaluation to a specific zone. |
| `isUnique` | `boolean` | `true` \| `false` | Filters cards with unique titles (diamond symbol). |
| `costMin` | `number` | Integer $\ge 0$ | Minimum printed card cost. |
| `costMax` | `number` | Integer $\ge 0$ | Maximum printed card cost. |
| `hasKeyword` | `enum` | `'Guard'`, `'Overkill'`, `'Quickstrike'`, `'Ranged'`, `'Retaliate'`, `'Toughness'`, `'Crisis'`, `'Hazard'`, `'Acceleration'` | Matches active keywords / scheme icons. |
