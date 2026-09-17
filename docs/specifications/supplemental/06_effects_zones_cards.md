# 05. Zones, Card Movement & Hand Size Primitives

---

## 1. Card Draw & Hand Mechanics

### `DRAW`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts))
- **Description:** Draws N cards from target player's draw deck into hand, with optional hand size boundary limits. Handles deck reshuffle and acceleration token penalties.

```json
{
  "effect": "DRAW",
  "params": {
    "count": 2,
    "target": "ACTIVE_PLAYER"
  }
}
```

```json
{
  "effect": "DRAW",
  "params": {
    "limit": "PRINTED_HAND_SIZE"
  }
}
```

| Parameter        | Type                                 | Required | Description                                                                                                                                              |
| :--------------- | :----------------------------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `count`          | `number \| DynamicValueSource`       | No       | Number of cards to draw. Defaults to `1` if `limit` is not specified.                                                                                    |
| `limit`          | `"HAND_SIZE" \| "PRINTED_HAND_SIZE"` | No       | Upper boundary constraint. When set without `count`, draws until hand reaches limit. When set with `count`, draws up to `count` without exceeding limit. |
| `target`         | `TargetSelector`                     | No       | Target player selector (`ACTIVE_PLAYER`, `CHOSEN_PLAYER`, `ALL_PLAYERS`, etc.). Defaults to triggering player.                                           |
| `targetPlayerId` | `string`                             | No       | Explicit target player identifier.                                                                                                                       |
| `dynamicBonus`   | `number \| DynamicValueSource`       | No       | Dynamic bonus card draw calculated from identity, traits, or game state (e.g. *Alpha Flight Station* `01015`).                                            |

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

| Parameter        | Type                    | Required | Description                                                                                                                                 |
| :--------------- | :---------------------- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `scaling`        | `"PER_MATCHING_CARD"`   | No       | Multiplies count of matching tableau cards.                                                                                                 |
| `filter`         | `UniversalCardFilter`   | No       | Matching criteria per [**04. Universal Card Filter**](./04_universal_card_filter.md) (e.g. `{ "types": ["upgrade"], "traits": ["Tech"] }`). |
| `multiplier`     | `number`                | No       | Multiplier per matching card (default `1`).                                                                                                 |
| `amount`         | `number`                | No       | Flat hand size modifier (`+1`, `-1`).                                                                                                       |
| `maxHandSize`    | `number`                | No       | Upper clamp (e.g. `7`).                                                                                                                     |
| `minHandSize`    | `number`                | No       | Lower clamp.                                                                                                                                |
| `applicableForm` | `"hero" \| "alter_ego"` | No       | Restricts bonus to specific identity form.                                                                                                  |

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
      "types": ["upgrade", "support"]
    },
    "fallback": "SURGE",
    "target": "ACTIVE_PLAYER"
  }
}
```

| Parameter     | Type                                                                                          | Required | Description                                                                                                                              |
| :------------ | :-------------------------------------------------------------------------------------------- | :------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `source`      | `"HAND" \| "DECK" \| "ENCOUNTER_DECK" \| "TABLEAU" \| "HOST" \| "SELF" \| "CARDS_UNDER_HOST"` | No       | Source zone cards leave from (default: `"HAND"`).                                                                                        |
| `count`       | `number \| "ALL"`                                                                             | No       | Number of cards to discard (default: `1`).                                                                                               |
| `mode`        | `"CHOSEN" \| "RANDOM" \| "TOP" \| "ALL" \| "UNTIL_MATCH"`                                     | No       | Selection algorithm (`"RANDOM"` for hand penalties, `"TOP"` for deck milling).                                                           |
| `target`      | `TargetSelector`                                                                              | No       | Player identity or entity executing or affected by the discard.                                                                          |
| `filter`      | `UniversalCardFilter`                                                                         | No       | Card filtering criteria per [**04. Universal Card Filter**](./04_universal_card_filter.md) (e.g. `{ "types": ["upgrade", "support"] }`). |
| `untilFilter` | `UniversalCardFilter`                                                                         | No       | Predicate for iterative milling until a matching card is found. See [**04. Universal Card Filter**](./04_universal_card_filter.md).      |
| `fallback`    | `"SURGE" \| "NONE"`                                                                           | No       | Fallback resolution if no matching cards can be discarded (e.g. _Caught Off Guard_).                                                     |

#### 🧭 Decision Guide: `DISCARD` vs. `SEARCH`

| Feature              | `DISCARD` (Attrition & Removal)                                                         | `SEARCH` (Discovery & Retrieval)                                                                                                                     |
| :------------------- | :-------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rules Reference**  | **"Discard" (p. 10)**                                                                   | **"Search" (p. 26)** & **"Look at" (p. 19)**                                                                                                         |
| **Primary Intent**   | Destruction, penalty, or milling into discard pile.                                     | Inspection, drafting, or tutoring cards to keep/play.                                                                                                |
| **Card Destination** | **Always Discard Pile** (`player.discard` / `encounterDiscard`).                        | **Two-Pile Split**: selected cards go to `selectedDestination` (`HAND`, `TABLEAU`), remainder to `unselectedDestination` (`DISCARD`, `DECK_BOTTOM`). |
| **Example Cards**    | _Caught Off Guard_, _Black Cat_ (01002), _Charge_, Obligations, Treachery hand discard. | _Tony Stark_ (Futurist `01029b`), _Make the Call_, _Ancestral Knowledge_.                                                                            |

- **Rule of Thumb:** If any card is kept, drawn into hand, or put into play, use **`SEARCH`**. If all cards are destroyed, milled, or sacrificed, use **`DISCARD`**.

#### 🔄 Downstream Resolution: `DISCARDED_CARDS` Dynamic Value Evaluation

Cards that inspect cards discarded in a preceding step (*"for each ... discarded this way"*) resolve dynamically via `amount: { from: "DISCARDED_CARDS" }` (see [**09. Dynamic Formulas**](./09_dynamic_formulas.md)).

```json
{
  "effect": "DEAL_DAMAGE",
  "params": {
    "amount": 1,
    "dynamicBonus": {
      "from": "DISCARDED_CARDS",
      "discardAttribute": "RESOURCE_ICONS",
      "resourceType": "energy",
      "multiplier": 2
    },
    "target": "CHOSEN_ENEMY"
  }
}
```

Supported `discardAttribute` inspection modes:
- `COUNT`: Number of matching cards discarded (default).
- `RESOURCE_ICONS`: Sum of printed resource icons (filtered by `resourceType`, or all printed icons if omitted).
- `DIFFERENT_RESOURCES`: Count of distinct resource types (`physical`, `energy`, `mental`, `wild`) with $> 0$ icons.
- `BOOST_ICONS`: Sum of boost icons across discarded cards.
- `DIFFERENT_CARD_TYPES`: Count of distinct card types across discarded cards.
- `PRINTED_COST`: Sum of printed card costs.

---

## 3. Search, Split & Zone Manipulations

### `SEARCH`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`effects/index.ts`](../../../src/engine/effects/index.ts) / ADR-0030, ADR-0058 / _Tony Stark_ `01029b` Futurist / _T'Challa_ `01040b` Foresight / _Shuri_ `01041`)
- **Description:** Universal declarative search and card discovery primitive. Inspects cards from a source zone (`PLAYER_DECK`, `PLAYER_DISCARD`, `ENCOUNTER_DECK`, `ENCOUNTER_DISCARD`, `PLAYER_HAND`), filters candidates matching criteria (`targetCardCode`, `trait`, `type`, etc.), and presents an interactive `PendingDecisionPrompt` allowing the player to select up to `takeCount` cards into `selectedDestination` (`HAND`, `TABLEAU`, etc.), routing unselected looked cards to `unselectedDestination` (`DISCARD`, `DECK_BOTTOM`, etc.) with optional post-search shuffle (`shuffleAfter`) and automatic resolution for unambiguous matches (`autoSelectIfUnambiguous`).

#### Parameters

| Parameter                 | Type                                    | Required | Default                                 | Description                                                                                                                                                                     |
| :------------------------ | :-------------------------------------- | :------- | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `source`                  | `SearchZone \| SearchZone[]`            | No       | `"PLAYER_DECK"`                         | Source zone(s) to search (`"PLAYER_DECK"`, `"PLAYER_DISCARD"`, `"ENCOUNTER_DECK"`, `"ENCOUNTER_DISCARD"`, `"PLAYER_HAND"`). Can be an array (e.g. `["ENCOUNTER_DECK", "ENCOUNTER_DISCARD"]`). |
| `lookCount`               | `number \| "ALL" \| DynamicValueSource` | No       | `undefined`                             | Number of top cards to look at. If `0`, `"ALL"`, or omitted (`undefined`), searches the **entire source zone/pile**. If `1+`, slices top $X$ cards. Cannot be negative.      |
| `takeCount`               | `number \| "ALL" \| DynamicValueSource` | No       | `1`                                     | Number of matching cards to select. If `0` or `"ALL"`, takes **all matching cards** without a prompt. If `1+`, takes up to $X$ cards with selection prompt if choices exist. |
| `filter`                  | `UniversalCardFilter`                   | No       | `undefined`                             | Canonical filter predicate. See [**04. Universal Card Filter**](./04_universal_card_filter.md) (e.g. `{ "traits": ["Tech"], "types": ["upgrade"] }`, `{ "codes": ["01046"] }`). |
| `selectedDestination`     | `enum`                                  | No       | `"HAND"`                                | Destination zone for chosen cards (`"HAND"`, `"TABLEAU"`, `"DECK_TOP"`, `"DISCARD"`, `"ATTACH_TO_TARGET"`, `"REVEAL"`).                                                         |
| `unselectedDestination`   | `enum`                                  | No       | `null`                                  | Destination for remaining looked cards (`"DISCARD"`, `"DECK_BOTTOM"`, `"DECK_SHUFFLE"`, `"DECK_TOP"`, `"LEAVE_IN_PLACE"`).                                                      |
| `shuffleAfter`            | `boolean`                               | No       | `true` (if lookCount omitted) / `false` | Whether to shuffle the searched deck(s) after search completion. Automatically shuffles all decks included in `source`.                                                        |
| `autoSelectIfUnambiguous` | `boolean`                               | No       | `true`                                  | When `true`, automatically resolves without a decision prompt when matching candidate count $\le$ `takeCount`.                                                                  |
| `isVoluntary`             | `boolean`                               | No       | `false`                                 | When `true` or when triggered from a player action, player may pass and choose not to take any cards (`"Pass / Do not select"`).                                                |
| `promptTitle`             | `string`                                | No       | Contextual                              | Custom user-facing dialog title displayed in the decision prompt modal.                                                                                                         |

#### Example 1: Look & Split (Tony Stark Futurist `01029b`)

```json
{
  "effect": "SEARCH",
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
  "effect": "SEARCH",
  "params": {
    "source": "PLAYER_DECK",
    "filter": {
      "traits": ["Black Panther"],
      "types": ["upgrade"]
    },
    "takeCount": 1,
    "selectedDestination": "HAND",
    "shuffleAfter": true,
    "promptTitle": "Foresight: Search deck for a Black Panther upgrade"
  }
}
```

#### Example 3: Multi-Zone Search & Encounter Reveal (Rhino Stage II `01095`)

```json
{
  "effect": "SEARCH",
  "params": {
    "source": ["ENCOUNTER_DECK", "ENCOUNTER_DISCARD"],
    "filter": {
      "targetCardCode": "01107"
    },
    "takeCount": 1,
    "selectedDestination": "REVEAL",
    "shuffleAfter": true,
    "autoSelectIfUnambiguous": true
  }
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

### `PLAY_FROM_ZONE`

- **Status:** 🟢 `IMPLEMENTED (v1.0)` ([ADR-0047](../../decisions/0047-playing-cards-from-non-hand-zones.md) / Issue [#25](https://github.com/SteveRodrigue/MCD/issues/25) - _Make the Call_ `01071`)
- **Description:** Enables playing a card from a non-hand zone (e.g. `PLAYER_DISCARD`, `ANY_PLAYER_DISCARD`, `PLAYER_DECK`, `ATTACHED`, `TUCKED`) matching filter constraints, with optional cost mode (`PRINTED_COST`, `FREE`, `REDUCED`).

```json
{
  "effect": "PLAY_FROM_ZONE",
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
