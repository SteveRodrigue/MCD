# 01. Metadata, Root & Audit Specification

> [!NOTE]
> Validated automatically via [`src/data/supplemental/schema.ts`](../../../src/data/supplemental/schema.ts).

---

## 1. Supplemental Root Structure

Each supplemental pack file under `src/data/supplemental/pack/*.json` maps 5-to-6 character card codes to a `CardEnrichment` object:

```json
{
  "cards": {
    "01001a": {
      "abilities": [ ... ],
      "audit": {
        "comment": "HERO: Spider-Man. Interrupt: When attacked, draw 1 card.",
        ...
      },
      "errata": null
    }
  }
}
```

---

## 2. Field Specifications: `CardEnrichment`

| Field                       | Type               | Required | Description                                                                                                                                                                                                                                                                                                                                                                                     |
| :-------------------------- | :----------------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `abilities`                 | `CardAbility[]`    | Optional | Array of declarative ability objects. Empty array `[]` if passive card or unverified.                                                                                                                                                                                                                                                                                                           |
| `playRequirements`          | `PlayRequirements` | Optional | Card-level form, trait, and control constraints (RR v1.8 p. 16, see [Module 11](./11_play_requirements.md)).                                                                                                                                                                                                                                                                                    |
| `audit`                     | `CardAuditRecord`  | Optional | Audit and verification metadata trail. Required for cards with confidence $\ge 95\%$.                                                                                                                                                                                                                                                                                                           |
| `noSupplementalNeeded`      | `boolean`          | Optional | Flag set to `true` strictly for vanilla cards with 0 printed rules text (e.g. basic double resources) and for cards whose only printed text is keywords the importer derives (e.g. Luke Cage `01076`, Toughness) or deck-building text only ("Max N per deck", e.g. `01088` to `01090`). Deck limits are not declared here: they are the upstream `deck_limit`, read by deck validation (#261). |
| `isLandscape`               | `boolean`          | Optional | Indicates horizontal orientation (e.g. main schemes, side schemes).                                                                                                                                                                                                                                                                                                                             |
| `attackCost`                | `number`           | Optional | Consequential damage suffered when an ally executes a basic attack (default: 1).                                                                                                                                                                                                                                                                                                                |
| `thwartCost`                | `number`           | Optional | Consequential damage suffered when an ally executes a basic thwart (default: 1).                                                                                                                                                                                                                                                                                                                |
| `maxPerPlayer`              | `number`           | Optional | Maximum copies a single player can have in play simultaneously (e.g. `1` for Max 1 per player).                                                                                                                                                                                                                                                                                                 |
| `recipient`                 | `PlayerRecipient`  | Optional | Obligation recipient override, outside `abilities` (`FIRST_PLAYER`, `REVEALING_PLAYER`, `CARD_SET_OWNER`, `{ type: "IDENTITY", codes }`). Absent = default: owner of the card's hero set when it belongs to one, else the revealing player (ADR-0075).                                                                                                                                          |
| `attachTo`                  | `AttachTo`         | Optional | Encounter attachment host, outside `abilities` (#209). `{ host, otherwise? }`; see [Encounter attachment host](#encounter-attachment-host-attachto). Absent = the active villain.                                                                                                                                                                                                               |
| `playUnderAnyPlayerControl` | `boolean`          | Optional | Allows card to be played under any player's control (RR v1.8, ADR-0066).                                                                                                                                                                                                                                                                                                                        |
| `uses`                      | `CardUses`         | Optional | Counters configured when entering play (`count`, `counterType`, `discardOnEmpty`).                                                                                                                                                                                                                                                                                                              |
| `victoryPoints`             | `number`           | Optional | Numeric value of printed `Victory X` keyword (RR v1.8 p. 30, ADR-0034). Paired with `keywords: ["Victory"]`.                                                                                                                                                                                                                                                                                    |
| `keywords`                  | `KeywordEntry[]`   | Optional | Card-level keywords. Supports plain strings or `StructuredKeywordSchema` for parameterized keywords per ADR-0054.                                                                                                                                                                                                                                                                               |
| `traits`                    | `string[]`         | Optional | Printed traits or supplemental trait extensions (e.g. `["Avenger", "Aerial"]`).                                                                                                                                                                                                                                                                                                                 |
| `restrictedSlots`           | `number`           | Optional | Number of restricted slots consumed by this card (e.g. `1` or `2`, RR v1.8 p. 24).                                                                                                                                                                                                                                                                                                              |
| `additionalBoostCards`      | `number`           | Optional | Additional boost cards dealt to this enemy activation during attacks or schemes.                                                                                                                                                                                                                                                                                                                |
| `errata`                    | `string \| null`   | Optional | Text override if card has official FFG ruling/errata. Renders **[ERRATA]** UI badge.                                                                                                                                                                                                                                                                                                            |

> [!NOTE]
> `errata` is also accepted on an individual ability (`CardAbility.errata`). Use it when the official errata (`references/rules/appendices/05_card_errata.md`) differs from the upstream printed text that `audit.originalText` mirrors, and model the **errata** wording in the steps. Example: _Iron Man_ `01029a` records "(to a maximum of +6 hand size)" where the printed card says "(to a maximum hand size of 7)".

> [!NOTE]
> Root-level `comment` was decommissioned and encapsulated into `audit.comment` per [ADR-0067](../../decisions/0067-encapsulating-supplemental-comments-into-audit-metadata.md). Root `comment` is strictly rejected by `CardEnrichmentSchema`.

> [!NOTE]
> `victoryPoints` routes the defeated card to the permanent `state.victoryDisplay` zone instead of its normal discard pile (see [ADR-0034](../../decisions/0034-player-side-schemes-victory-display-and-auxiliary-decks.md)).

### Encounter attachment host (`attachTo`)

"Attach to X. Otherwise, ..." on an encounter attachment (#209). Resolved when the attachment is revealed, after the cancel window: the attachment itself is never cancelled (#175).

```json
{
  "attachTo": {
    "host": {
      "type": "MINION",
      "superlative": { "stat": "PRINTED_HIT_POINTS", "extreme": "HIGHEST" }
    },
    "otherwise": { "type": "SURGE" }
  }
}
```

| Field                      | Values                                                                       | Meaning                                                                                                                                                                                         |
| :------------------------- | :--------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `host.type`                | `VILLAIN`, `MINION`, `ENEMY`                                                 | `VILLAIN` is the active villain. `MINION` is an engaged minion of any player. `ENEMY` is a minion or a villain in play.                                                                         |
| `host.filter`              | `UniversalCardFilter`                                                        | Keeps the candidates whose card matches (names, traits, ...).                                                                                                                                   |
| `host.withoutCopyAttached` | `boolean`                                                                    | Skips candidates already carrying a copy (same card code) of the attachment.                                                                                                                    |
| `host.superlative`         | `{ stat: PRINTED_HIT_POINTS \| PRINTED_ATTACK, extreme: HIGHEST \| LOWEST }` | Keeps the candidates with the highest / lowest printed value (a villain reads its printed card values).                                                                                         |
| `otherwise`                | a host, or `{ "type": "SURGE" }`                                             | Used when `host` has no candidate. `SURGE`: the card goes to the encounter discard pile and the surge card is dealt (once, even when the card also prints Surge). A second host attaches there. |

- One candidate: it attaches without a prompt. Several (a tie, or no superlative): the **first player** chooses through a decision prompt, whoever revealed the card.
- No candidate for `host` and no `otherwise`: the active villain (the same as no `attachTo`).
- The effects of an attachment on its host are ordinary abilities. "Attached minion gets +3 hit points" is a `CONSTANT` `MODIFY_MAX_HEALTH` step with `amount: 3`. A minion's maximum is its printed hit points plus these modifiers (`getEffectiveMinionHitPoints`). When the attachment leaves, damage stays on the minion and only the ceiling drops: a minion with damage at or above its new maximum is defeated.

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
| `comment`       | `string` | Free text            | Human developer commentary reserved strictly for user notes per ADR-0067.            |
