# Universal Card Filter Specification

- **Module Status:** 🟢 `IMPLEMENTED (v1.0)` ([`src/engine/filters/card-filter.ts`](../../../src/engine/filters/card-filter.ts) / [ADR-0046](../../decisions/0046-universal-declarative-card-filtering-architecture.md))
- **Schema Authority:** [`src/data/supplemental/schema.ts`](../../../src/data/supplemental/schema.ts) (`UniversalCardFilterSchema`, `CardCriteriaSchema`)
- **Rules Authority:** Marvel Champions Rules Reference (RR v1.8 p. 19 "Look at", p. 26 "Search", p. 28 "Target")

---

## 1. Overview & Architecture

In Marvel Champions LCG, card filtering governs the legal universe of targets for deck searches, discards, state mutations, dynamic stat bonuses, and board manipulations.

Rather than defining ad-hoc or duplicated filter properties across individual effect primitives (`SEARCH_AND_SELECT`, `DISCARD`, `MODIFY_HAND_SIZE`, `PUT_INTO_PLAY`, `READY`, `EXHAUST`), MCD establishes a **single, universal, declarative card filtering architecture** per [ADR-0046](../../decisions/0046-universal-declarative-card-filtering-architecture.md).

All consuming effects accept the identical `filter?: UniversalCardFilter` schema and evaluate card eligibility through a single pure, card-agnostic engine function:
```typescript
matchesCardFilter(card: CardView | NormalizedCard, filter?: UniversalCardFilter, context?: FilterContext): boolean
```

---

## 2. TypeScript & Zod Schema Definition

```typescript
export interface NumberComparison {
  min?: number;
  max?: number;
  equals?: number;
}

export interface CardCriteria {
  // Identity & Codes
  codes?: string[];
  names?: string[];
  isIdentitySpecific?: boolean;
  isUnique?: boolean;

  // Classification
  types?: CardType[];
  traits?: string[];
  aspects?: Aspect[];
  sets?: string[];

  // Numbers, Costs & Icons
  cost?: NumberComparison;
  resourceIcons?: ('physical' | 'energy' | 'mental' | 'wild')[];

  // Keywords & In-Play States
  hasKeyword?: Keyword;
  isExhausted?: boolean;
  hasStatus?: ('STUNNED' | 'CONFUSED' | 'TOUGH')[];
}

export type UniversalCardFilter = CardCriteria & {
  all?: UniversalCardFilter[]; // Logical AND
  any?: UniversalCardFilter[]; // Logical OR
  none?: UniversalCardFilter[]; // Logical NOT
};
```

---

## 3. Filter Criteria Reference

| Criterion | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `codes` | `string[]` | Matches exact card code(s). | `{ "codes": ["01046", "01047"] }` |
| `names` | `string[]` | Matches card title (case-insensitive). | `{ "names": ["Avengers Mansion"] }` |
| `types` | `CardType[]` | Matches card type (`"upgrade"`, `"support"`, `"ally"`, `"event"`, `"minion"`, `"side_scheme"`, etc.). Matches both normalized and raw `type_code`. | `{ "types": ["upgrade", "support"] }` |
| `traits` | `string[]` | Matches bold bracketed traits (`[[Tech]]`, `[[Avenger]]`). Punctuation and casing resilient (e.g. `"S.H.I.E.L.D."` matches `"SHIELD"`). | `{ "traits": ["Tech"] }` |
| `aspects` | `Aspect[]` | Matches card aspect or faction (`"aggression"`, `"justice"`, `"leadership"`, `"protection"`, `"basic"`, `"encounter"`). | `{ "aspects": ["leadership"] }` |
| `sets` | `string[]` | Matches encounter set or hero set. Special value `"PLAYER_NEMESIS"` matches the resolving hero's set-aside nemesis set. | `{ "sets": ["PLAYER_NEMESIS"] }` |
| `isUnique` | `boolean` | Matches unique cards marked with the unique title diamond symbol ($\star$). | `{ "isUnique": true }` |
| `isIdentitySpecific` | `boolean` | Restricts matching to cards belonging to the active player's identity set. | `{ "isIdentitySpecific": true }` |
| `cost` | `NumberComparison` | Compares printed card resource cost (`min`, `max`, `equals`). | `{ "cost": { "max": 2 } }` |
| `resourceIcons` | `ResourceType[]` | Matches cards bearing printed resource icons (`"physical"`, `"energy"`, `"mental"`, `"wild"`). | `{ "resourceIcons": ["mental"] }` |
| `hasKeyword` | `Keyword` | Matches cards with the specified active keyword (`"Guard"`, `"Overkill"`, `"Quickstrike"`, `"Ranged"`, `"Retaliate"`, `"Toughness"`, etc.). | `{ "hasKeyword": "Guard" }` |
| `isExhausted` | `boolean` | When evaluating cards in play, matches exhaustion orientation. | `{ "isExhausted": true }` |
| `hasStatus` | `CharacterStatus[]` | When evaluating characters in play, matches attached status cards (`"STUNNED"`, `"CONFUSED"`, `"TOUGH"`). | `{ "hasStatus": ["TOUGH"] }` |

---

## 4. Boolean Combinators (`all`, `any`, `none`)

Filters support arbitrary composability using boolean combinator arrays:

### Logical OR (`any`)
Matches if **any** sub-filter in the list matches.
```json
{
  "any": [
    { "traits": ["Avenger"], "types": ["ally"] },
    { "traits": ["Tech"], "types": ["upgrade"] }
  ]
}
```
*Meaning:* Match any card that is either an Avenger ally OR a Tech upgrade.

### Logical NOT / Exclusion (`none`)
Excludes candidates that match **any** sub-filter in the list.
```json
{
  "types": ["ally"],
  "none": [
    { "isUnique": true }
  ]
}
```
*Meaning:* Match any non-unique ally.

### Nested Complex Queries (`all` + `any` + `none`)
```json
{
  "all": [
    { "types": ["upgrade", "support"] },
    { "cost": { "max": 2 } }
  ],
  "none": [
    { "aspects": ["encounter"] }
  ]
}
```

---

## 5. Integration Across Effect Primitives

| Effect Primitive | Parameter | Documentation |
| :--- | :--- | :--- |
| **`SEARCH_AND_SELECT`** | `filter` | [05. Zones & Cards (Search)](./05_effects_zones_cards.md#search_and_select) |
| **`DISCARD`** | `filter`, `untilFilter` | [05. Zones & Cards (Discard)](./05_effects_zones_cards.md#discard) |
| **`MODIFY_HAND_SIZE`** | `filter` (or step `filter`) | [05. Zones & Cards (Hand Size)](./05_effects_zones_cards.md#modify_hand_size) |
| **`PUT_INTO_PLAY`** | `filter` | [05. Zones & Cards (Put Into Play)](./05_effects_zones_cards.md#put_into_play) |
| **`EXHAUST` / `READY`** | `filter` | [06. Status & Economy](./06_effects_status_economy.md#exhaust-and-ready) |
