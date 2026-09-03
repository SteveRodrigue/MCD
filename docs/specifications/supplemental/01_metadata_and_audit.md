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
      "mechanicSteps": [ ... ],
      "errata": null
    }
  }
}
```

---

## 2. Field Specifications: `CardEnrichment`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `comment` | `string` | Optional | Human-readable explanation of card type, title, and mechanics. |
| `abilities` | `CardAbility[]` | Optional | Array of declarative ability objects. Empty array `[]` if passive card or unverified. |
| `audit` | `CardAuditRecord` | Optional | Audit and verification metadata trail. Required for cards with confidence $\ge 95\%$. |
| `mechanicSteps` | `string[]` | Optional | Granular step-by-step translation matching printed text. |
| `noSupplementalNeeded` | `boolean` | Optional | Flag set to `true` strictly for vanilla cards with 0 printed rules text (e.g. basic double resources). |
| `victoryPoints` | `number` | Optional | Numeric value of the printed `Victory X` keyword (RR v1.8 p. 30, ADR-0034). Must be paired with `keywords: ["Victory"]` on the normalized card. Routes the card to the permanent `state.victoryDisplay` zone instead of its normal discard pile when defeated. |
| `errata` | `string \| null` | Optional | Text override if card has official FFG ruling/errata. Renders **[ERRATA]** UI badge. |

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
  "originalText": "Spider-Sense — <b>Interrupt</b>: When the villain initiates an attack against you, draw 1 card.",
  "reconstructedText": "INTERRUPT (ATTACK) -> DRAW_CARDS (count: 1)"
}
```

| Field | Type | Format / Constraints | Description |
| :--- | :--- | :--- | :--- |
| `createdAt` | `string` | `YYYY-MM-DDTHH:MM` | ISO-8601 creation timestamp. |
| `updatedAt` | `string` | `YYYY-MM-DDTHH:MM` | ISO-8601 last modified timestamp. |
| `reviewedAt` | `string` | `YYYY-MM-DDTHH:MM` | ISO-8601 verification review timestamp. |
| `reviewedBy` | `string` | Non-empty string | Author / Agent identifier (e.g. `"antigravity"`, `"community"`). |
| `rulesVersion` | `string` | `"v1.8"` | Official Marvel Champions Rules Reference version. |
| `confidence` | `number` | `0` to `100` | Integer rating. Confidence $\ge 95\%$ enables ambiguity pruning (Inbox Zero). |
| `originalText` | `string` | Raw text | Exact printed rules text from upstream/printed card for self-contained auditability. |
| `reconstructedText`| `string` | Markdown string | Decompiled pseudo-code derived 100% from `abilities` to prove round-trip integrity. |
