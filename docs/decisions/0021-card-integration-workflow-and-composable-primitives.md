# ADR-0021: Standard Card Integration Protocol & Composable Primitives Architecture

## Status
Accepted

## Context & Problem Statement
When digitizing card games with extensive card pools like Marvel Champions, two common failure modes occur:
1. **Ad-Hoc Interpretation / Guesswork:** Developers informally guess or assume card interactions, misinterpreting exact scopes (e.g. conflating *Villain Schemes* with *Minion Schemes*, or missing identity resource timings).
2. **Card-Specific Monolithic Logic ("Spaghetti Code"):** Writing custom one-off engine functions for each individual card (e.g. a dedicated `handleBlackCat()` function) leads to code bloat, fragility, and inability to support the full 1,000+ card catalog.

To guarantee fidelity to **Marvel Champions Rules Reference v1.8** and maintain a clean, extensible codebase, we require a standardized engineering protocol and a composable primitive design pattern.

---

## Decision

We establish the **8-Step Card Integration Protocol** and **Composable Primitives Architecture**:

### 1. The 8-Step Integration Protocol
Every card added or refined must follow these exact sequential steps:
1. **Ingest Upstream Text:** Read exact printed text from `data/upstream/`.
2. **Literal Semantic Mapping:** Identify timing, triggers, costs, targets, and form constraints without interpretation.
3. **Draft Supplemental Schema:** Define explicit `abilities`, `timing`, `trigger`, `cost`, `effect`, `params`, and `tags`.
4. **Consult Ground Truth (`references/`):** Check `references/rules_reference_v18.md` and MarvelCDB FAQs (`https://marvelcdb.com/faqs`). Apply **The Golden Rule** (Card text overrules general rules).
5. **Bidirectional Round-Trip Test:** Translate supplemental code back into human language. Proceed only if confidence is $\ge 95\%$.
6. **Engine Reuse Check:** Check `src/engine/effects/` and `src/engine/triggers/` before authoring new logic.
7. **Author Composable Generic Primitives:** If extending the engine, build generic reusable building blocks (e.g., `INSPECT_DECK_CARDS`, `FILTER_CARD_STACK`, `ROUTING`).
8. **Codify `mechanicSteps` in Schema & Specs:** Populate `mechanicSteps` in JSON and add algorithmic spec to `docs/specs/card-mechanics-breakdown.md`.

### 2. Composable Primitives Design Pattern
Engine effects must never be card-specific. They must be generic pipeline operations:
* **Inspection Primitive:** Inspect $N$ cards from top/bottom of any zone (`draw_deck`, `discard`, `encounter_deck`).
* **Filtering Primitive:** Partition a card array by predicate (e.g. resource icon, card type, trait) into `{ matched, unmatched }`.
* **Routing Primitive:** Move cards to target destinations (`HAND`, `DISCARD`, `TABLEAU`, `DECK_TOP`, `DECK_BOTTOM`).

---

## Consequences

* **100% Rules Reference v1.8 Adherence:** Cards function exactly as written and officially ruled.
* **Maximized Code Reuse:** Complex multi-step cards compose from shared generic primitives.
* **Complete Transparency:** Every card includes a human-readable `mechanicSteps` breakdown co-located in the JSON schema and documented in developer specs.
