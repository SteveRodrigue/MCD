# 05. Zones, Card Movement & Hand Size Primitives

---

## 1. Card Draw & Hand Mechanics

### `DRAW_CARDS`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L43`](file:///c:/Users/steve/OneDrive/Documents/Coding/MCD/src/engine/effects/index.ts#L43))
* **Description:** Draws N cards from target player's draw deck into hand. Handles deck reshuffle and acceleration token penalties.

```json
{
  "effect": "DRAW_CARDS",
  "params": {
    "count": 2,
    "target": "ACTIVE_PLAYER"
  }
}
```

---

### `MODIFY_HAND_SIZE`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` (Issue [#9](https://github.com/SteveRodrigue/MCD/issues/9) / *Iron Man* `01029a`)
* **Description:** Continuous aura modifying live effective hand size dynamically during round upkeep and UI rendering. Supports trait scaling and min/max clamping.

```json
{
  "effect": "MODIFY_HAND_SIZE",
  "params": {
    "scaling": "PER_MATCHING_TABLEAU_CARD",
    "filter": {
      "type": "upgrade",
      "trait": "Tech"
    },
    "amountPerCard": 1,
    "maxHandSize": 7,
    "applicableForm": "hero"
  }
}
```

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `scaling` | `"PER_MATCHING_TABLEAU_CARD"` | No | Multiplies count of matching tableau cards. |
| `filter` | `FilterSchema` | No | Matching criteria (e.g. `{ "type": "upgrade", "trait": "Tech" }`). |
| `amountPerCard`| `number` | No | Multiplier per matching card (default `1`). |
| `amount` | `number` | No | Flat hand size modifier (`+1`, `-1`). |
| `maxHandSize` | `number` | No | Upper clamp (e.g. `7`). |
| `minHandSize` | `number` | No | Lower clamp. |
| `applicableForm`| `"hero" \| "alter_ego"` | No | Restricts bonus to specific identity form. |

---

## 2. Search, Split & Zone Manipulations

### `SCRY_AND_SELECT_TRAIT` / `SEARCH_AND_DRAW`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L465`](file:///c:/Users/steve/OneDrive/Documents/Coding/MCD/src/engine/effects/index.ts#L465) / *Tony Stark* `01029b` Futurist)
* **Description:** Looks at top N cards of player deck, opens an interactive `PendingDecisionPrompt` allowing the player to choose M cards matching a trait filter into hand (or decline), and discards unselected cards.

```json
{
  "effect": "SEARCH_AND_DRAW",
  "params": {
    "lookCount": 3,
    "chooseCount": 1,
    "destination": "HAND",
    "unselectedDestination": "DISCARD",
    "filter": {
      "trait": "Tech"
    }
  }
}
```

---

### `CHANGE_FORM_DRAW_TO_HAND_SIZE`
* **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L1082`](file:///c:/Users/steve/OneDrive/Documents/Coding/MCD/src/engine/effects/index.ts#L1082) / *Split Personality* `01025`)
* **Description:** Flips the player's active identity card to their alternate form independently without consuming or requiring their basic once-per-round form change action (`basicChangeFormUsedThisRound`), then draws cards from deck up to the printed hand size limit of the newly active form.

```json
{
  "effect": "CHANGE_FORM_DRAW_TO_HAND_SIZE"
}
```

---

### `PLAY_FROM_ZONE`
* **Status:** 🟡 `ROADMAP` (Issue [#25](https://github.com/SteveRodrigue/MCD/issues/25) - *Make the Call* `01071`)
* **Description:** Enables playing a card from a non-hand zone (e.g. player discard pile) with filter constraints.

```json
{
  "effect": "PLAY_FROM_ZONE",
  "params": {
    "sourceZone": "PLAYER_DISCARD",
    "filter": {
      "type": "ally"
    }
  }
}
```
