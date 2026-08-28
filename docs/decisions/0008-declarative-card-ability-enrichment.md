# ADR-0008: Declarative Card Ability & Effect Enrichment Architecture

## Status
Accepted (Updated with 100% Coverage & Status Signal Requirement)

## Context
As the engine grows to support hundreds of Marvel Champions cards, hardcoding card IDs (e.g. `if (player.card.code === '01001a')`) directly into the rules engine loops creates tight coupling, severe duplication, and unmaintainable code.

Many cards share identical or parameterized mechanics:
* Drawing cards upon a trigger condition (e.g. *Spider-Sense*, *Avengers Mansion*, *One-Two Punch*).
* Preventing attack damage (e.g. *Backflip*, *Side Step*, *Energy Barrier*).
* Dealing damage to enemies with keywords/tags (e.g. *Swinging Web Kick*, *Haymaker*, *Shield Toss*).
* Healing damage via actions (e.g. *Aunt May*, *First Aid*, *Med Team*).
* Resource generation via counters or tapping (e.g. *Web-Shooter*, *Helicarrier*, *Enhanced Reflexes*).

Furthermore, without an explicit contract and validation rule, it is difficult to determine whether a card in the raw upstream dataset has no supplemental metadata because it was **intentionally evaluated as needing no custom hooks** or because it was **accidentally forgotten or skipped**.

---

## Decision

We establish a **2-layer data-driven ability architecture** with **100% mandatory card coverage and explicit status signals**:

### 1. Supplemental Declarative Pack Data (`src/data/supplemental/pack/`)

Supplemental files mirror the upstream **zzorba pack datasets** 1-to-1:

```
src/data/supplemental/
├── index.ts                     # Aggregates and exports supplementalRegistry
└── pack/
    ├── core.json                # Supplemental data for all core player cards (01001a..01093)
    ├── core_encounter.json      # Supplemental data for all core encounter cards (01094..01185)
    ├── goblin.json              # Future scenario pack supplemental
    └── ...
```

### 2. 100% Card Registration & Explicit Status Signals

**Every single card in an upstream pack MUST be registered in its corresponding supplemental file.** No card may be omitted.

Each entry includes an explicit status signal:

```typescript
export type SupplementalStatus =
  | 'ENRICHED'               // Custom abilities, triggers, costs, or uses are defined
  | 'NO_SUPPLEMENTAL_NEEDED'  // Explicitly verified as operating on standard printed rules
  | 'PENDING';               // Requires attention (fails validation if present)

export interface CardEnrichment {
  cardName?: string;
  comment?: string;
  isLandscape?: boolean;
  status?: SupplementalStatus;
  needsSupplemental?: boolean; // Set to false when fully handled
  uses?: CardUsesDefinition;
  abilities?: CardAbility[];
}
```

#### Example 1: Enriched Card (`ENRICHED`)
```json
"01001a": {
  "cardName": "Spider-Man",
  "status": "ENRICHED",
  "needsSupplemental": false,
  "comment": "Hero Identity: When villain initiates an attack against you, draw 1 card.",
  "abilities": [
    {
      "id": "spider_sense",
      "timing": "INTERRUPT",
      "trigger": "VILLAIN_INITIATES_ATTACK",
      "effect": "DRAW_CARDS",
      "params": { "count": 1, "target": "SELF" }
    }
  ]
}
```

#### Example 2: Verified Standard Card (`NO_SUPPLEMENTAL_NEEDED`)
```json
"01088": {
  "cardName": "Energy",
  "status": "NO_SUPPLEMENTAL_NEEDED",
  "needsSupplemental": false,
  "comment": "Resource Card: Operates on printed resource icons (2 Energy); no custom engine trigger required.",
  "abilities": []
}
```

### 3. Automated Completeness Validation in CI

Unit tests (`tests/data/card-loader.test.ts`) programmatically iterate over **100% of cards in upstream packs** and assert:
1. Every card code is registered in `supplementalRegistry`.
2. Every card has a valid status (`ENRICHED` or `NO_SUPPLEMENTAL_NEEDED`).
3. `needsSupplemental` is strictly `false` (no card is in `PENDING` state).

### 4. Generic Trigger Dispatcher & Reusable Effect Primitives (`src/engine/effects/` & `src/engine/triggers/`)

* The rules engine executes timing windows via a generic `TriggerDispatcher`.
* The engine contains **0 hardcoded card codes**.
* Reusable effect primitives (`draw-cards`, `deal-damage`, `prevent-damage`, `heal-damage`, `generate-resource`, `remove-threat`) resolve card abilities deterministically.

---

## Consequences

### Positive:
* **Zero Forgotten Cards:** Automated test suites guarantee 100% coverage across all card packs; missing or pending cards fail the test suite immediately.
* **Explicit Clarity:** Clear distinction between cards requiring custom supplemental logic vs. cards operating on standard engine rules.
* **Infinite Scalability:** Adding new hero and encounter packs is purely additive with standardized validation.
* **Clean Decoupling:** Complete separation between upstream datasets, MCD supplemental enrichment metadata, and headless rules execution.
