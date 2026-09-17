# 01. Metadata, Root & Audit Specification

> [!NOTE]
> **Status:** 🟢 `IMPLEMENTED (v1.0)`  
> Validated automatically via [`src/data/supplemental/schema.ts`](../../../src/data/supplemental/schema.ts).

---

## 1. Supplemental Root Structure

Each supplemental pack file under `src/data/supplemental/pack/*.json` maps 5-to-6 character card codes to a `CardEnrichment` object:

```json
{
  "cards": {
    "01001a": {
      "comment": "HERO: Spider-Man. Interrupt: When attacked, draw 1 card.",
      "abilities": [ ... ],
      "audit": { ... },
      "errata": null
    }
  }
}
```

---

## 2. Field Specifications: `CardEnrichment`

| Field                  | Type                           | Required | Description                                                                                                        |
| :--------------------- | :----------------------------- | :------- | :----------------------------------------------------------------------------------------------------------------- |
| `comment`              | `string`                       | Optional | Human-readable explanation of card type, title, and mechanics.                                                     |
| `abilities`            | `CardAbility[]`                | Optional | Array of declarative ability objects. Empty array `[]` if passive card or unverified.                              |
| `playRequirements`     | `PlayRequirements`             | Optional | Card-level form, trait, and control constraints (RR v1.8 p. 16, see [Module 11](./11_play_requirements.md)).       |
| `audit`                | `CardAuditRecord`              | Optional | Audit and verification metadata trail. Required for cards with confidence $\ge 95\%$.                              |
| `noSupplementalNeeded` | `boolean`                      | Optional | Flag set to `true` strictly for vanilla cards with 0 printed rules text (e.g. basic double resources).             |
| `isLandscape`          | `boolean`                      | Optional | Indicates horizontal orientation (e.g. main schemes, side schemes).                                                |
| `attackCost`           | `number`                       | Optional | Consequential damage suffered when an ally executes a basic attack (default: 1).                                   |
| `thwartCost`           | `number`                       | Optional | Consequential damage suffered when an ally executes a basic thwart (default: 1).                                   |
| `maxPerPlayer`         | `number`                       | Optional | Maximum copies a single player can have in play simultaneously (e.g. `1` for Max 1 per player).                     |
| `uses`                 | `CardUses`                     | Optional | Counters configured when entering play (`count`, `counterType`, `max`, `discardOnEmpty`).                          |
| `victoryPoints`        | `number`                       | Optional | Numeric value of printed `Victory X` keyword (RR v1.8 p. 30, ADR-0034). Paired with `keywords: ["Victory"]`.       |
| `keywords`             | `KeywordEntry[]`               | Optional | Card-level keywords. Supports plain strings or `StructuredKeywordSchema` for parameterized keywords per ADR-0054.  |
| `traits`               | `string[]`                     | Optional | Printed traits or supplemental trait extensions (e.g. `["Avenger", "Aerial"]`).                                    |
| `restrictedSlots`      | `number`                       | Optional | Number of restricted slots consumed by this card (e.g. `1` or `2`, RR v1.8 p. 24).                                 |
| `additionalBoostCards` | `number`                       | Optional | Additional boost cards dealt to this enemy activation during attacks or schemes.                                   |
| `errata`               | `string \| null`               | Optional | Text override if card has official FFG ruling/errata. Renders **[ERRATA]** UI badge.                               |

> [!NOTE]
> `victoryPoints` routes the defeated card to the permanent `state.victoryDisplay` zone instead of its normal discard pile (see [ADR-0034](../../decisions/0034-player-side-schemes-victory-display-and-auxiliary-decks.md)).

### Structured Keywords (`StructuredKeywordSchema`, ADR-0054)

Cards declaring parameterized keywords (such as `Retaliate X`) declare them under root card `keywords` using either a plain string (e.g. `"Retaliate 1"`) or a structured object:

```json
{
  "keywords": [
    {
      "keyword": "Retaliate",
      "amount": 1
    }
  ]
}
```

| Field     | Type     | Required | Description                                                         |
| :-------- | :------- | :------- | :------------------------------------------------------------------ |
| `keyword` | `string` | Yes      | Canonical keyword name (`"Retaliate"`, `"Overkill"`, `"Piercing"`). |
| `amount`  | `number` | Optional | Numeric magnitude for parameterized keywords ($X$).                 |

---

## 3. Field Specifications: `CardAuditRecord`

```json
"audit": {
  "createdAt": "2026-08-27T23:00",
  "updatedAt": "2026-08-28T14:40",
  "reviewedAt": "2026-08-28T14:40",
  "reviewedBy": "antigravity",
  "rulesVersion": "v1.8",
  "confidence": 98,
  "ambiguityFile": "docs/ambiguities/01001.md",
  "originalText": "Spider-Sense — <b>Interrupt</b>: When the villain initiates an attack against you, draw 1 card."
}
```

| Field           | Type     | Format / Constraints | Description                                                                          |
| :-------------- | :------- | :------------------- | :----------------------------------------------------------------------------------- |
| `createdAt`     | `string` | `YYYY-MM-DDTHH:MM`   | ISO-8601 creation timestamp.                                                         |
| `updatedAt`     | `string` | `YYYY-MM-DDTHH:MM`   | ISO-8601 last modified timestamp.                                                    |
| `reviewedAt`    | `string` | `YYYY-MM-DDTHH:MM`   | ISO-8601 verification review timestamp.                                              |
| `reviewedBy`    | `string` | Non-empty string     | Author / Agent identifier (e.g. `"antigravity"`, `"community"`).                     |
| `rulesVersion`  | `string` | `"v1.8"`             | Official Marvel Champions Rules Reference version.                                   |
| `confidence`    | `number` | `0` to `100`         | Integer rating. Confidence $\ge 95\%$ enables ambiguity pruning (Inbox Zero).        |
| `ambiguityFile` | `string` | Relative path        | Relative path to ambiguity tracking document in `docs/ambiguities/` (if applicable). |
| `originalText`  | `string` | Raw text             | Exact printed rules text from upstream/printed card for self-contained auditability. |
