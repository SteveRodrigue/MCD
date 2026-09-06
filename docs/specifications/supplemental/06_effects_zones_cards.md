# 05. Zones, Card Movement & Hand Size Primitives

---

## 1. Card Draw & Hand Mechanics

### `DRAW_CARDS`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L43`](../../../src/engine/effects/index.ts#L43))
- **Description:** Draws N cards from target player's draw deck into hand. Handles deck reshuffle and acceleration token penalties.

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

- **Status:** 🟢 `IMPLEMENTED (v1.0)` (Issue [#9](https://github.com/SteveRodrigue/MCD/issues/9) / _Iron Man_ `01029a`)
- **Description:** Continuous aura modifying live effective hand size dynamically during round upkeep and UI rendering. Supports trait scaling and min/max clamping.

```json
{
  "effect": "MODIFY_HAND_SIZE",
  "params": {
    "scaling": "PER_MATCHING_CARD",
    "filter": {
      "types": ["upgrade"],
      "traits": ["Tech"]
    },
    "multiplier": 1,
    "maxHandSize": 7,
    "applicableForm": "hero"
  }
}
```

| Parameter        | Type                          | Required | Description                                                        |
| :--------------- | :---------------------------- | :------- | :----------------------------------------------------------------- |
| `scaling`        | `"PER_MATCHING_CARD"`         | No       | Multiplies count of matching tableau cards.                        |
| `filter`         | `UniversalCardFilter`         | No       | Matching criteria per [**04. Universal Card Filter**](./04_universal_card_filter.md) (e.g. `{ "types": ["upgrade"], "traits": ["Tech"] }`). |
| `multiplier`     | `number`                      | No       | Multiplier per matching card (default `1`).                        |
| `amount`         | `number`                      | No       | Flat hand size modifier (`+1`, `-1`).                              |
| `maxHandSize`    | `number`                      | No       | Upper clamp (e.g. `7`).                                            |
| `minHandSize`    | `number`                      | No       | Lower clamp.                                                       |
| `applicableForm` | `"hero" \| "alter_ego"`       | No       | Restricts bonus to specific identity form.                         |

---

## 2. Card Attrition & Discard Primitives

### `DISCARD`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts) / Issue [#66](https://github.com/SteveRodrigue/MCD/issues/66))
- **Description:** Moves cards from a specified source zone (`HAND`, `DECK`, `ENCOUNTER_DECK`, `TABLEAU`, `HOST`, `SELF`, `CARDS_UNDER_HOST`) directly to the discard pile (or encounter discard pile for encounter cards) per RR v1.8 p. 10. Supports random hand selection, filtering, iterative milling, and fallback actions (e.g. Surge when no valid target in tableau).

```json
{
  "effect": "DISCARD",
  "params": {
    "source": "TABLEAU",
    "filter": {
      "cardTypes": ["upgrade", "support"]
    },
    "fallback": "SURGE",
    "target": "ACTIVE_PLAYER"
  }
}
```

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `source` | `"HAND" \| "DECK" \| "ENCOUNTER_DECK" \| "TABLEAU" \| "HOST" \| "SELF" \| "CARDS_UNDER_HOST"` | No | Source zone cards leave from (default: `"HAND"`). |
| `count` | `number \| "ALL"` | No | Number of cards to discard (default: `1`). |
| `mode` | `"CHOSEN" \| "RANDOM" \| "TOP" \| "ALL" \| "UNTIL_MATCH"` | No | Selection algorithm (`"RANDOM"` for hand penalties, `"TOP"` for deck milling). |
| `target` | `TargetSelector` | No | Player identity or entity executing or affected by the discard. |
| `filter` | `UniversalCardFilter` | No | Card filtering criteria per [**04. Universal Card Filter**](./04_universal_card_filter.md) (e.g. `{ "types": ["upgrade", "support"] }`). |
| `untilFilter` | `UniversalCardFilter` | No | Predicate for iterative milling until a matching card is found. See [**04. Universal Card Filter**](./04_universal_card_filter.md). |
| `fallback` | `"SURGE" \| "NONE"` | No | Fallback resolution if no matching cards can be discarded (e.g. *Caught Off Guard*). |

#### 🧭 Decision Guide: `DISCARD` vs. `SEARCH_AND_SELECT`

| Feature | `DISCARD` (Attrition & Removal) | `SEARCH_AND_SELECT` (Discovery & Retrieval) |
| :--- | :--- | :--- |
| **Rules Reference** | **"Discard" (p. 10)** | **"Search" (p. 26)** & **"Look at" (p. 19)** |
| **Primary Intent** | Destruction, penalty, or milling into discard pile. | Inspection, drafting, or tutoring cards to keep/play. |
| **Card Destination** | **Always Discard Pile** (`player.discard` / `encounterDiscard`). | **Two-Pile Split**: selected cards go to `selectedDestination` (`HAND`, `TABLEAU`), remainder to `unselectedDestination` (`DISCARD`, `DECK_BOTTOM`). |
| **Example Cards** | *Caught Off Guard*, *Black Cat* (01002), *Charge*, Obligations, Treachery hand discard. | *Tony Stark* (Futurist `01029b`), *Make the Call*, *Ancestral Knowledge*. |

- **Rule of Thumb:** If any card is kept, drawn into hand, or put into play, use **`SEARCH_AND_SELECT`**. If all cards are destroyed, milled, or sacrificed, use **`DISCARD`**.

---

## 3. Search, Split & Zone Manipulations

### `SEARCH_AND_SELECT`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts) / ADR-0030 / _Tony Stark_ `01029b` Futurist / _T'Challa_ `01040b` Foresight / _Shuri_ `01041`)
- **Description:** Universal declarative search and card discovery primitive. Inspects cards from a source zone (`PLAYER_DECK`, `PLAYER_DISCARD`, `ENCOUNTER_DECK`, `ENCOUNTER_DISCARD`, `PLAYER_HAND`), filters candidates matching criteria (`targetCardCode`, `trait`, `type`, etc.), and presents an interactive `PendingDecisionPrompt` allowing the player to select up to `takeCount` cards into `selectedDestination` (`HAND`, `TABLEAU`, etc.), routing unselected looked cards to `unselectedDestination` (`DISCARD`, `DECK_BOTTOM`, etc.) with optional post-search shuffle (`shuffleAfter`).
- **Supersedes:** `SEARCH_DECK_FOR_CARD` (deprecated and removed in Issue #39). All deck and zone searching is unified under `SEARCH_AND_SELECT`.

#### Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `source` | `enum` | No | `"PLAYER_DECK"` | Source zone (`"PLAYER_DECK"`, `"PLAYER_DISCARD"`, `"ENCOUNTER_DECK"`, `"ENCOUNTER_DISCARD"`, `"PLAYER_HAND"`). |
| `lookCount` | `number` | No | `undefined` | Number of top cards to look at. If omitted/undefined, searches the entire source zone. |
| `takeCount` | `number` | No | `1` | Maximum number of matching cards the player may select. |
| `filter` | `UniversalCardFilter` | No | `undefined` | Canonical filter predicate. See [**04. Universal Card Filter**](./04_universal_card_filter.md) (e.g. `{ "traits": ["Tech"], "types": ["upgrade"] }`, `{ "codes": ["01046"] }`). |
| `selectedDestination` | `enum` | No | `"HAND"` | Destination zone for chosen cards (`"HAND"`, `"TABLEAU"`, `"DECK_TOP"`, `"DISCARD"`, `"ATTACH_TO_TARGET"`). |
| `unselectedDestination` | `enum` | No | `null` | Destination for remaining looked cards (`"DISCARD"`, `"DECK_BOTTOM"`, `"DECK_SHUFFLE"`, `"DECK_TOP"`, `"LEAVE_IN_PLACE"`). |
| `shuffleAfter` | `boolean` | No | `true` (if lookCount omitted) / `false` | Whether to shuffle the deck after search completion. |
| `isVoluntary` | `boolean` | No | `false` | When `true`, player may choose fewer than `takeCount` cards or decline. |
| `promptTitle` | `string` | No | Contextual | Custom user-facing dialog title displayed in the decision prompt modal. |

#### Example 1: Look & Split (Tony Stark Futurist `01029b`)
```json
{
  "effect": "SEARCH_AND_SELECT",
  "params": {
    "source": "PLAYER_DECK",
    "lookCount": 3,
    "filter": {
      "traits": ["Tech"]
    },
    "takeCount": 1,
    "selectedDestination": "HAND",
    "unselectedDestination": "DISCARD",
    "shuffleAfter": false,
    "promptTitle": "Futurist: Choose 1 Tech card to add to hand"
  }
}
```

#### Example 2: Full-Deck Tutor Search (T'Challa Foresight `01040b` / Shuri `01041`)
```json
{
  "effect": "SEARCH_AND_SELECT",
  "params": {
    "source": "PLAYER_DECK",
    "filter": {
      "trait": "Black Panther",
      "type": "upgrade"
    },
    "takeCount": 1,
    "selectedDestination": "HAND",
    "shuffleAfter": true,
    "promptTitle": "Foresight: Search deck for a Black Panther upgrade"
  }
}
```

---

### `CHANGE_FORM_DRAW_TO_HAND_SIZE`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts:L1082`](../../../src/engine/effects/index.ts#L1082) / _Split Personality_ `01025`)
- **Description:** Flips the player's active identity card to their alternate form independently without consuming or requiring their basic once-per-round form change action (`basicChangeFormUsedThisRound`), then draws cards from deck up to the printed hand size limit of the newly active form.

```json
{
  "effect": "CHANGE_FORM_DRAW_TO_HAND_SIZE"
}
```

---

### `PUT_INTO_PLAY`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` (ADR-0029 / _Shadow of the Past_ `01190`, _Rhino Stage II_ `01095`, _Make the Call_ `01071`)
- **Description:** Transfers matching cards from a source zone into play at the specified destination, resolving all standard entrance lifecycle rules (attaching Toughness/Guard keywords, calculating starting threat for side schemes, and triggering When Revealed / Enters Play responses per RR v1.8 p. 14). Uses [**04. Universal Card Filter**](./04_universal_card_filter.md).

```json
{
  "effect": "PUT_INTO_PLAY",
  "params": {
    "from": "SET_ASIDE",
    "to": "ENGAGED_WITH_PLAYER",
    "filter": {
      "types": ["minion"],
      "sets": ["PLAYER_NEMESIS"]
    }
  }
}
```

---

### `SHUFFLE_INTO_DECK`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` (ADR-0029 / _Shadow of the Past_ `01190`, _Ancestral Knowledge_ `01042`)
- **Description:** Collects matching cards from a specified source zone (`from`: `"SET_ASIDE" | "DISCARD" | "HAND"`), places them into the target deck (`toDeck`: `"ENCOUNTER_DECK" | "PLAYER_DECK"`), and shuffles the deck. Uses [**04. Universal Card Filter**](./04_universal_card_filter.md).

```json
{
  "effect": "SHUFFLE_INTO_DECK",
  "params": {
    "from": "SET_ASIDE",
    "toDeck": "ENCOUNTER_DECK",
    "filter": {
      "sets": ["PLAYER_NEMESIS"]
    }
  }
}
```

---

### `PLAY_CARD_FROM_ZONE`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([ADR-0047](../../decisions/0047-playing-cards-from-non-hand-zones.md) / Issue [#25](https://github.com/SteveRodrigue/MCD/issues/25) - _Make the Call_ `01071`)
- **Description:** Enables playing a card from a non-hand zone (e.g. `PLAYER_DISCARD`, `ANY_PLAYER_DISCARD`, `PLAYER_DECK`, `ATTACHED`, `TUCKED`) matching filter constraints, with optional cost mode (`PRINTED_COST`, `FREE`, `REDUCED`).

```json
{
  "effect": "PLAY_CARD_FROM_ZONE",
  "params": {
    "source": "ANY_PLAYER_DISCARD",
    "filter": {
      "types": ["ally"]
    },
    "costMode": "PRINTED_COST",
    "destination": "TABLEAU",
    "control": "SELF"
  }
}
```
