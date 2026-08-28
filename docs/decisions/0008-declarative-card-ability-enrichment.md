# ADR-0008: Declarative Card Ability & Effect Enrichment Architecture

## Status
Accepted (Updated with 100% Card Registration & `noSupplementalNeeded` Signal)

## Context
As the engine grows to support hundreds of Marvel Champions cards, hardcoding card IDs (e.g. `if (player.card.code === '01001a')`) directly into the rules engine loops creates tight coupling, severe duplication, and unmaintainable code.

Many cards share identical or parameterized mechanics:
* Drawing cards upon a trigger condition (e.g. *Spider-Sense*, *Avengers Mansion*, *One-Two Punch*).
* Preventing attack damage (e.g. *Backflip*, *Side Step*, *Energy Barrier*).
* Dealing damage to enemies with keywords/tags (e.g. *Swinging Web Kick*, *Haymaker*, *Shield Toss*).
* Healing damage via actions (e.g. *Aunt May*, *First Aid*, *Med Team*).
* Resource generation via counters or tapping (e.g. *Web-Shooter*, *Helicarrier*, *Enhanced Reflexes*).

Furthermore, without an explicit registration requirement, it is impossible to distinguish between a card that **operates entirely on standard printed rules** vs. a card that was **accidentally forgotten or skipped**.

---

## Decision

We establish a **2-layer data-driven ability architecture** with **100% mandatory card registration**:

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

### 2. 100% Card Registration & Explicit `noSupplementalNeeded` Signal

**Every single card in an upstream pack MUST be registered in its corresponding supplemental file.**

To keep data files clean and readable without redundant fields:
* Cards requiring custom engine triggers/effects include their declarative `abilities` array (and optional `uses` counters or `isLandscape`).
* Cards that operate purely on standard printed rules/stats include an explicit `"noSupplementalNeeded": true` signal.

```typescript
export interface CardEnrichment {
  noSupplementalNeeded?: boolean;
  cardName?: string;
  comment?: string;
  isLandscape?: boolean;
  uses?: CardUsesDefinition;
  abilities?: CardAbility[];
}
```

#### Example 1: Enriched Card with Custom Abilities
```json
"01001a": {
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

#### Example 2: Evaluated Standard Card (No Supplemental Needed)
```json
"01088": {
  "noSupplementalNeeded": true
}
```

### 3. Automated Completeness Validation in CI

Unit tests (`tests/data/card-loader.test.ts`) programmatically iterate over **100% of cards in upstream packs** and assert:
1. Every card code is registered in `supplementalRegistry`.
2. Every card either defines active `abilities` OR has `"noSupplementalNeeded": true`.

### 4. Generic Trigger Dispatcher & Reusable Effect Primitives (`src/engine/effects/` & `src/engine/triggers/`)

* The rules engine executes timing windows via a generic `TriggerDispatcher`.
* The engine contains **0 hardcoded card codes**.
* Reusable effect primitives (`draw-cards`, `deal-damage`, `prevent-damage`, `heal-damage`, `generate-resource`, `remove-threat`) resolve card abilities deterministically.

---

## Consequences

### Positive:
* **Zero Forgotten Cards:** Automated test suites guarantee 100% coverage across all card packs; missing cards fail the test suite immediately.
* **Visually Clean & Minimal:** No redundant boilerplate fields (`status`, `needsSupplemental`); a single `"noSupplementalNeeded": true` clearly documents standard cards.
* **Infinite Scalability:** Adding new hero and encounter packs is purely additive with standardized validation.
* **Clean Decoupling:** Complete separation between upstream datasets, MCD supplemental enrichment metadata, and headless rules execution.
