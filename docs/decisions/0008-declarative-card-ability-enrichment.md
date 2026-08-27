# ADR-0008: Declarative Card Ability & Effect Enrichment Architecture

## Status
Accepted

## Context
As the engine grows to support hundreds of Marvel Champions cards, hardcoding card IDs (e.g. `if (player.card.code === '01001a')`) directly into the rules engine loops creates tight coupling, severe duplication, and unmaintainable code.

Many cards share identical or parameterized mechanics:
* Drawing cards upon a trigger condition (e.g. *Spider-Sense*, *Avengers Mansion*, *One-Two Punch*).
* Preventing attack damage (e.g. *Backflip*, *Side Step*, *Energy Barrier*).
* Dealing damage to enemies with keywords/tags (e.g. *Swinging Web Kick*, *Haymaker*, *Shield Toss*).
* Healing damage via actions (e.g. *Aunt May*, *First Aid*, *Med Team*).
* Resource generation via counters or tapping (e.g. *Web-Shooter*, *Helicarrier*, *Enhanced Reflexes*).

## Decision
We establish a **2-layer data-driven ability architecture**:
### 1. Supplemental Declarative Pack Data (`src/data/supplemental/pack/`)

Rather than maintaining a single monolithic supplemental file, supplemental files mirror the upstream **zzorba pack dataset** 1-to-1:

```
src/data/supplemental/
├── index.ts                     # Aggregates and exports supplementalRegistry
└── pack/
    ├── core.json                # Supplemental data for core player cards (01001a..01093)
    ├── core_encounter.json      # Supplemental data for core encounter cards (01094..01190)
    ├── goblin.json              # Future scenario pack supplemental
    └── ...
```

Example (`src/data/supplemental/pack/core.json`):
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "cards": {
    "01001a": {
      "cardName": "Spider-Man",
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
  }
}
```

2. **Generic Trigger Dispatcher & Reusable Effect Primitives (`src/engine/effects/` & `src/engine/triggers/`):**
   * The rules engine executes timing windows via a generic `TriggerDispatcher`.
   * The engine contains **0 hardcoded card codes**.
   * Reusable effect primitives (`draw-cards`, `deal-damage`, `prevent-damage`, `heal-damage`, `generate-resource`, `remove-threat`) resolve card abilities deterministically.

## Consequences
* **Positive:** Infinite scalability for new heroes, villains, and encounter sets without modifying core engine pipeline loops.
* **Positive:** 100% testable and reusable effect primitives.
* **Positive:** Clean separation between upstream data, MCD enrichment metadata, and headless engine logic.
