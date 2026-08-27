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
1. **Supplemental Enrichment Layer (`src/data/supplemental/card-effects.json`):**
   * Stores declarative metadata for card triggers, timing windows, costs, effect primitives, and parameter maps keyed by MarvelsDB card code.
   * `CardCatalog` loads raw upstream data from `data/upstream/` (zzorba) and merges it with `card-effects.json` at startup.
2. **Generic Trigger Dispatcher & Reusable Effect Primitives (`src/engine/effects/` & `src/engine/triggers/`):**
   * The rules engine executes timing windows via a generic `TriggerDispatcher`.
   * The engine contains **0 hardcoded card codes**.
   * Reusable effect primitives (`draw-cards`, `deal-damage`, `prevent-damage`, `heal-damage`, `generate-resource`, `remove-threat`) resolve card abilities deterministically.

## Consequences
* **Positive:** Infinite scalability for new heroes, villains, and encounter sets without modifying core engine pipeline loops.
* **Positive:** 100% testable and reusable effect primitives.
* **Positive:** Clean separation between upstream data, MCD enrichment metadata, and headless engine logic.
