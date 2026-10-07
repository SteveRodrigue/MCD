# 06. Zones, Card Movement & Hand Size Primitives

---

## 1. Card Draw & Hand Mechanics

### `DRAW`

- **References:** [`effects/index.ts`](../../../src/engine/effects/index.ts)
- **Description:** Draws N cards from target player's draw deck into hand, with optional hand size boundary limits. Handles deck reshuffle and acceleration token penalties.

```json
{
  "effect": "DRAW",
  "effectParams": {
    "count": 2,
    "target": "ACTIVE_PLAYER"
  }
}
```

```json
{
  "effect": "DRAW",
  "effectParams": {
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

- **References:** Issue [#9](https://github.com/SteveRodrigue/MCD/issues/9), reworked for _Iron Man_ `01029a` in WP2 / [#227](https://github.com/SteveRodrigue/MCD/issues/227); [`getEffectiveHandSize`](../../../src/engine/pipeline/stat-calculator.ts)
- **Description:** Continuous aura (`CONSTANT`) adding to the live effective hand size during end-of-phase draw/discard and UI rendering. `amount` is a number or a `DynamicValueSource` (see [08. Dynamic Formulas](./09_dynamic_formulas.md)); printed caps are declared with the formula's `clamp.max`. The resulting hand size is never negative; the Rules Reference sets no other bound.

```json
{
  "id": "iron_man_hand_size",
  "timing": "CONSTANT",
  "errata": "You get +1 hand size for each [[Tech]] upgrade you control (to a maximum of +6 hand size).",
  "steps": [
    {
      "effect": "MODIFY_HAND_SIZE",
      "effectParams": {
        "amount": {
          "from": "ENTITY_COUNT",
          "filter": { "types": ["upgrade"], "traits": ["Tech"] },
          "clamp": { "max": 6 }
        }
      }
    }
  ]
}
```

| Parameter | Type                           | Required | Description                                                                                                                                                                    |
| :-------- | :----------------------------- | :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `amount`  | `number \| DynamicValueSource` | Yes      | Hand size modifier. Flat (`+1`, `-1`) or a formula; use `ENTITY_COUNT` with a card filter for "+1 for each ...", `multiplier` for other ratios and `clamp.max` for "to a maximum of +N". |

> **Retired parameters:** `scaling: "PER_MATCHING_CARD"`, `filter`, `multiplier`, `maxHandSize`, `minHandSize` and `applicableForm` were removed. The first three are replaced by the dynamic `amount` above. `maxHandSize` was never read by the engine and `minHandSize` never existed in it. `applicableForm` is redundant: identity abilities are read from the active form card only, so the hero card's ability is inert in alter-ego form.
>
> **Retired in #231:** the `scaling` values `PER_SIDE_SCHEME`, `PER_DISCARDED_CARD` and `PER_RESOURCE_SPENT`, with `multiplier` and `maxBonus`, on `MODIFY_STAT`, `REMOVE_THREAT` and `ADD_COUNTERS`. Use `ENTITY_COUNT`, `DISCARDED_CARDS` and `RESOURCES_SPENT` amounts (see `09_dynamic_formulas.md`).
>
> **Errata:** the official errata for Iron Man (`references/rules/appendices/05_card_errata.md`) caps the *bonus* at +6 rather than the total at 7 (same result for his printed hand size of 1). Data follows the errata; the ability records the errata text in its `errata` field.

---

## 2. Card Attrition & Discard Primitives

### `DISCARD`

- **References:** [`effects/index.ts`](../../../src/engine/effects/index.ts) / Issue [#66](https://github.com/SteveRodrigue/MCD/issues/66)
- **Description:** Moves cards from a specified source zone (`HAND`, `DECK`, `ENCOUNTER_DECK`, `TABLEAU`, `HOST`, `SELF`, `CARDS_UNDER_HOST`) directly to the discard pile (or encounter discard pile for encounter cards) per RR v1.8 p. 10. Supports random hand selection, filtering, iterative milling, and fallback actions (e.g. Surge when no valid target in tableau).

```json
{
  "effect": "DISCARD",
  "effectParams": {
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
| `matchingDestination` | `"HAND" \| "PLAY" \| "DISCARD" \| "REVEAL"` | No | Where the card that ends an `UNTIL_MATCH` goes (default `"DISCARD"`). `"REVEAL"` reveals it (encounter deck only). |

#### `HAND` source: filter, `RANDOM`, each-player targets and results (#219)

The hand source applies `filter` (every hand card is a candidate when there is none), so `count: "ALL"` with `filter: { "resourceIcons": ["energy"] }` discards each energy resource (a printed wild icon counts) and keeps the rest (_Yon-Rogg's Treason_ `01179`). `mode: "RANDOM"` picks the N cards at random among the filtered candidates; any other mode takes the first N. The step acts on every player the `target` resolves to (`ALL_PLAYERS`: first player first), one selection per hand; a player with no candidate discards nothing and does not stop the others (_The Vulture's Plans_ `01169`).

The step always returns `discardedCards` (all players, in seat order) and `value` (their total), so `DISCARDED_CARDS` (`DIFFERENT_RESOURCES`) and the `IF_AMOUNT_ZERO` gate ("if you discarded no cards this way") work after a hand discard in any mode. One `card.discarded.fromHand` log entry is written per player.

#### `ENCOUNTER_DECK` with `mode: "UNTIL_MATCH"` (_Masterplan_ `01192`)

"Discard cards from the top of the encounter deck until a ... is discarded. Reveal it." discards one card at a time until a card matches `untilFilter`. Each non-matching card goes to the encounter discard pile. The matching card goes to `matchingDestination`: `"DISCARD"` (default) puts it in the encounter discard pile; `"REVEAL"` has the player resolving the ability reveal it through the normal reveal path (RR v1.8 glossary "Reveal"), so its When Revealed abilities resolve. `HAND` and `PLAY` are not supported from the encounter deck.

**Empty deck rule** (RR v1.8 glossary "Encounter Deck"): if the encounter deck is emptied before a match is found, the discard stops and the effect is fulfilled; the discard pile (including the cards just discarded) is shuffled into a new encounter deck and an acceleration token is placed. The discard does not continue with the new deck.

```json
{
  "effect": "DISCARD",
  "condition": "ZONE_EMPTY",
  "gate": "IF_CONDITION_MET",
  "gateParams": { "zone": "SIDE_SCHEMES" },
  "effectParams": {
    "source": "ENCOUNTER_DECK",
    "mode": "UNTIL_MATCH",
    "untilFilter": { "types": ["side_scheme"] },
    "matchingDestination": "REVEAL"
  }
}
```

#### 🧭 Decision Guide: `DISCARD` vs. `SEARCH`

| Feature              | `DISCARD` (Attrition & Removal)                                                         | `SEARCH` (Discovery & Retrieval)                                                                                                                     |
| :------------------- | :-------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rules Reference**  | **"Discard" (p. 10)**                                                                   | **"Search" (p. 26)** & **"Look at" (p. 19)**                                                                                                         |
| **Primary Intent**   | Destruction, penalty, or milling into discard pile.                                     | Inspection, drafting, or tutoring cards to keep/play.                                                                                                |
| **Card Destination** | **Always Discard Pile** (`player.discard` / `encounterDiscard`).                        | **Two-Pile Split**: selected cards go to `selectedDestination` (`HAND`, `TABLEAU`, `DECK_SHUFFLE`), remainder to `unselectedDestination` (`DISCARD`, `DECK_BOTTOM`). |
| **Example Cards**    | _Caught Off Guard_, _Black Cat_ (01002), _Charge_, Obligations, Treachery hand discard. | _Tony Stark_ (Futurist `01029b`), _Make the Call_, _Ancestral Knowledge_.                                                                            |

- **Rule of Thumb:** If any card is kept, drawn into hand, or put into play, use **`SEARCH`**. If all cards are destroyed, milled, or sacrificed, use **`DISCARD`**.

#### 🔄 Downstream Resolution: `DISCARDED_CARDS` Dynamic Value Evaluation

Cards that inspect cards discarded in a preceding step (*"for each ... discarded this way"*) resolve dynamically via `amount: { from: "DISCARDED_CARDS" }` (see [**09. Dynamic Formulas**](./09_dynamic_formulas.md)).

```json
{
  "effect": "DEAL_DAMAGE",
  "effectParams": {
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

- **References:** [`effects/index.ts`](../../../src/engine/effects/index.ts) / ADR-0030, ADR-0058 / _Tony Stark_ `01029b` Futurist / _T'Challa_ `01040b` Foresight / _Shuri_ `01041`
- **Description:** Universal declarative search and card discovery primitive. Inspects cards from a source zone (`PLAYER_DECK`, `PLAYER_DISCARD`, `ENCOUNTER_DECK`, `ENCOUNTER_DISCARD`, `PLAYER_HAND`), filters candidates matching criteria (`targetCardCode`, `trait`, `type`, etc.), and presents an interactive `PendingDecisionPrompt` allowing the player to select up to `takeCount` cards into `selectedDestination` (`HAND`, `TABLEAU`, `DECK_SHUFFLE`, etc.), routing unselected looked cards to `unselectedDestination` (`DISCARD`, `DECK_BOTTOM`, etc.) with optional post-search shuffle (`shuffleAfter`) and automatic resolution for unambiguous matches (`autoSelectIfUnambiguous`).

#### Parameters

| Parameter                 | Type                                    | Required | Default                                 | Description                                                                                                                                                                     |
| :------------------------ | :-------------------------------------- | :------- | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `source`                  | `SearchZone \| SearchZone[]`            | No       | `"PLAYER_DECK"`                         | Source zone(s) to search (`"PLAYER_DECK"`, `"PLAYER_DISCARD"`, `"ENCOUNTER_DECK"`, `"ENCOUNTER_DISCARD"`, `"PLAYER_HAND"`). Can be an array (e.g. `["ENCOUNTER_DECK", "ENCOUNTER_DISCARD"]`). |
| `lookCount`               | `number \| "ALL" \| DynamicValueSource` | No       | `undefined`                             | Number of top cards to look at. If `0`, `"ALL"`, or omitted (`undefined`), searches the **entire source zone/pile**. If `1+`, slices top $X$ cards. Cannot be negative.      |
| `takeCount`               | `number \| "ALL" \| DynamicValueSource` | No       | `1`                                     | Maximum number of matching cards to select. If `0` or `"ALL"`, takes **all matching cards** without a prompt. If `1+`, the player chooses between `minimumTake` and $X$ cards when there is a choice. |
| `filter`                  | `UniversalCardFilter`                   | No       | `undefined`                             | Canonical filter predicate. See [**04. Universal Card Filter**](./04_universal_card_filter.md) (e.g. `{ "traits": ["Tech"], "types": ["upgrade"] }`, `{ "codes": ["01046"] }`). |
| `selectedDestination`     | `enum`                                  | No       | `"HAND"`                                | Destination zone for chosen cards (`"HAND"`, `"TABLEAU"`, `"DECK_TOP"`, `"DECK_BOTTOM"`, `"DECK_SHUFFLE"`, `"DISCARD"`, `"ATTACH_TO_TARGET"`, `"REVEAL"`).                                                         |
| `unselectedDestination`   | `enum`                                  | No       | `null`                                  | Destination for remaining looked cards (`"DISCARD"`, `"DECK_BOTTOM"`, `"DECK_SHUFFLE"`, `"DECK_TOP"`, `"LEAVE_IN_PLACE"`).                                                      |
| `shuffleAfter`            | `boolean`                               | No       | `true` (if lookCount omitted) / `false` | Whether to shuffle the searched deck(s) after search completion. Automatically shuffles all decks included in `source`.                                                        |
| `autoSelectIfUnambiguous` | `boolean`                               | No       | `true`                                  | When `true`, automatically resolves without a decision prompt when the number of candidates (distinct names with `distinctBy`) is $\le$ `minimumTake`, i.e. nothing is left to choose.                                                                  |
| `minimumTake`             | `integer >= 0`                          | No       | `1`                                     | Fewest cards the player must take. `0` = "up to `takeCount`" (Ancestral Knowledge `01042`). With fewer candidates than the minimum, all are taken. A search that "adds a card" is mandatory when a candidate exists (RR v1.8 Search). |
| `distinctBy`              | `"NAME"`                                | No       | `undefined`                             | The chosen cards must all be different: no two with the same card name. |
| `promptTitle`             | `string`                                | No       | Contextual                              | Custom user-facing dialog title displayed in the decision prompt modal.                                                                                                         |

#### Example 1: Look & Split (Tony Stark Futurist `01029b`)

```json
{
  "effect": "SEARCH",
  "effectParams": {
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
  "effectParams": {
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
  "effectParams": {
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

#### Example 4: Discard Retrieval & Deck Shuffle (Ancestral Knowledge `01042`)

```json
{
  "effect": "SEARCH",
  "effectParams": {
    "source": ["PLAYER_DISCARD"],
    "target": "SELF",
    "fromTop": false,
    "takeCount": 3,
    "autoSelectIfUnambiguous": true,
    "lookCount": "ALL",
    "selectedDestination": "DECK_SHUFFLE",
    "unselectedDestination": "DISCARD"
  }
}
```

---

### `PUT_INTO_PLAY`

- **References:** ADR-0029 / _Shadow of the Past_ `01190`, _Rhino Stage II_ `01095`, _Make the Call_ `01071`
- **Description:** Transfers matching cards from a source zone into play at the specified destination, resolving the standard entrance lifecycle (attaching Toughness, calculating starting threat for side schemes, Quickstrike, the `MINION_ENTERS_PLAY` trigger). Uses [**04. Universal Card Filter**](./04_universal_card_filter.md).
- **Parameters:**
  - `from` / `to`: source zone (`SET_ASIDE`, `DISCARD`, `HAND`, `DECK`) and destination (`TABLEAU`, `ENGAGED_WITH_PLAYER`, `SIDE_SCHEMES`).
  - `target: "SELF"`: the source card itself is put into play instead of cards chosen by `filter` (for example a boost card that puts itself into play). Omitted means filter-based.
  - `reveal: true`: for printed "reveal ... and put it into play". After the card enters play, its When Revealed abilities (`timing` or `trigger` `WHEN_REVEALED`) and keyword-provided Surge resolve (RR v1.8 glossary R, W). Without `reveal`, the card is only put into play: no When Revealed ability triggers and it does not surge. A forced response fires only from its own trigger, never on entry.
- **Reference cards:** _Shadow of the Past_ `01190` (`reveal: true`, both steps), _Weapons Runner_ `01121` (`target: "SELF"`, no `reveal`: its Boost puts it into play engaged with the player the activation is against, without Surge).

```json
{
  "effect": "PUT_INTO_PLAY",
  "effectParams": {
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

- **References:** ADR-0029 / _Shadow of the Past_ `01190`, _Ancestral Knowledge_ `01042`
- **Description:** Collects matching cards from a specified source zone (`from`: `"SET_ASIDE" | "DISCARD" | "HAND"`), places them into the target deck (`toDeck`: `"ENCOUNTER_DECK" | "PLAYER_DECK"`), and shuffles the deck. Uses [**04. Universal Card Filter**](./04_universal_card_filter.md).

```json
{
  "effect": "SHUFFLE_INTO_DECK",
  "effectParams": {
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

- **References:** [ADR-0047](../../decisions/0047-playing-cards-from-non-hand-zones.md) / Issue [#25](https://github.com/SteveRodrigue/MCD/issues/25) - _Make the Call_ `01071`
- **Description:** Enables playing a card from a non-hand zone (e.g. `PLAYER_DISCARD`, `ANY_PLAYER_DISCARD`, `PLAYER_DECK`, `ATTACHED`, `TUCKED`) matching filter constraints, with optional cost mode (`PRINTED_COST`, `FREE`, `REDUCED`).

```json
{
  "effect": "PLAY_FROM_ZONE",
  "effectParams": {
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

---

### `REMOVE_FROM_GAME`

- **References:** Issue #158 / core obligations: _Affairs of State_ `01155`, _Eviction Notice_ `01165`, _Family Emergency_ `01175`
- **Description:** Removes the source card from the game (RR v1.8 "Removed from the Game"). The card leaves every other zone and ends only in `state.removedFromGame`; it does not go to a discard pile and triggers no discard effects. Target is the source card (`SELF`).

```json
{
  "effect": "REMOVE_FROM_GAME",
  "effectParams": { "target": "SELF" }
}
```

---

### `ATTACH_FACEDOWN_CARDS_FROM_HAND` and `RETURN_TO_HAND` (cards underneath)

`ATTACH_FACEDOWN_CARDS_FROM_HAND` (no parameters): each player with a non-empty hand moves one random card from it to `cardsUnderneath` of the **host in play** that owns the source card (today: a side scheme in `state.sideSchemes`; the engine looks the host up by `instanceId`, never trusting the reveal-time instance). The card keeps `ownerId` = the player it came from. Players with an empty hand are skipped.

`RETURN_TO_HAND`, when the source card has cards underneath: each goes to the hand of its `ownerId` and `cardsUnderneath` is emptied. Otherwise it returns the source card itself (ally or tableau card) to its controller's hand.

Ordering on defeat (ADR-0034 addendum): the scheme's "When Defeated" abilities run **before** its attachments and cards underneath are discarded, so a card can return what is underneath. Anything still underneath afterwards is discarded.

### `CHANGE_FORM` (alias `FLIP_FORM`)

- **References:** Issue #158 (`form` and `optional` added).
- **Description:** Flips the identity to its other form. `effectParams.form` (`"hero"` | `"alter_ego"`) names the wanted form: if the identity is already in it, the step is a no-op. `effectParams.optional: true` queues a **voluntary** prompt ("Flip to <form>?") instead of flipping immediately. Flipping by a card ability does **not** count against the once-per-turn voluntary form change (RR v1.8 "Form").

```json
{
  "effect": "CHANGE_FORM",
  "effectParams": { "form": "alter_ego", "optional": true }
}
```
