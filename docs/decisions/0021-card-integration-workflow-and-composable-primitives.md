# ADR-0021: Standard Card Integration Protocol, Composable Primitives, Audit Metadata & Inbox-Zero Ambiguity Tracking

## Status
Accepted

## Context & Problem Statement
When digitizing card games with extensive card pools like Marvel Champions, four failure modes frequently arise:
1. **Ad-Hoc Interpretation / Guesswork:** Developers informally guess or assume card interactions, misinterpreting exact scopes (e.g. conflating *Villain Schemes* with *Minion Schemes*, or missing identity resource timings).
2. **Infinite Refinement Loops:** Attempting to force-fit ambiguous cards without a hard boundary leads to endless revision cycles.
3. **Card-Specific Monolithic Logic ("Spaghetti Code"):** Writing custom one-off engine functions for each individual card (e.g. a dedicated `handleBlackCat()` function) leads to code bloat, fragility, and inability to support the full 1,000+ card catalog.
4. **Lack of Audit Lifecycle Tracking:** Without timestamps and review metadata, it is impossible to know when a card was last verified against new rules or if recent changes were audited.

To guarantee fidelity to **Marvel Champions Rules Reference v1.8** and maintain a clean, extensible codebase, we require a standardized engineering protocol, a strict circuit-breaker, encapsulated audit metadata, and a 1-file-per-card ambiguity tracking queue.

---

## Decision

We establish the **8-Step Card Integration Protocol**, **Encapsulated Audit Metadata**, **Circuit-Breaker Rule**, and **1-File-Per-Card Ambiguity Queue (`docs/ambiguities/`)**:

### 1. The 8-Step Integration Protocol
Every card added or refined must follow these exact sequential steps:
1. **Ingest Upstream Text:** Read exact printed text from `data/upstream/`.
2. **Literal Semantic Mapping:** Identify timing, triggers, costs, targets, and form constraints without interpretation.
3. **Draft Supplemental Schema & Audit Block:** Define explicit `audit` (`createdAt`, `updatedAt`, `reviewedAt`, `rulesVersion`, `confidence`), `abilities`, `timing`, `trigger`, `cost`, `effect`, `params`, and `tags`.
4. **Consult Ground Truth (`references/`):** Check `references/rules_reference_v18.md` and MarvelCDB FAQs (`https://marvelcdb.com/faqs`). Apply **The Golden Rule** (Card text overrules general rules).
5. **Bidirectional Round-Trip Test & Circuit-Breaker:** Translate supplemental code back into human language. Proceed only if confidence is $\ge 95\%$.
   * **Max 3 Refinement Iterations:** If confidence remains $< 95\%$ after 3 attempts, **ABORT** integration and generate a blocked card report in `docs/ambiguities/{pack}_{code}_{slug}.md`.
6. **Engine Reuse Check:** Check `src/engine/effects/` and `src/engine/triggers/` before authoring new logic.
7. **Author Composable Generic Primitives:** If extending the engine, build generic reusable building blocks (e.g., `INSPECT_DECK_CARDS`, `FILTER_CARD_STACK`, `ROUTING`).
8. **Stamp Audit (HH:MM), Codify Specs & Prune Ambiguity:** Stamp ISO timestamps (`YYYY-MM-DDTHH:mm`), populate `mechanicSteps` in JSON, document specs in `docs/specs/card-mechanics-breakdown.md`, and **delete the corresponding ambiguity file** in `docs/ambiguities/` upon successful resolution (Inbox Zero).

### 2. Encapsulated Audit Metadata Schema
```json
"audit": {
  "createdAt": "YYYY-MM-DDTHH:mm",
  "updatedAt": "YYYY-MM-DDTHH:mm",
  "reviewedAt": "YYYY-MM-DDTHH:mm",
  "reviewedBy": "antigravity",
  "rulesVersion": "v1.8",
  "confidence": 98
}
```
* **New Card:** `createdAt`, `updatedAt`, `reviewedAt` set to current timestamp.
* **Bug Fix / Logic Modification:** `updatedAt` and `reviewedAt` bumped to current timestamp.
* **Verification Audit (Zero Code Changes):** `reviewedAt` bumped to current timestamp.

### 3. Inbox Zero Ambiguity Queue (`docs/ambiguities/`)
* Each blocked card generates its own dedicated file: `docs/ambiguities/{pack}_{card_code}_{slug}.md`.
* Files contain YAML frontmatter (`card_code`, `card_name`, `confidence_reached`, `blocker_category`) and forensic failure details.
* As developers resolve blockers, files are deleted. An empty directory signifies 100% engine compatibility.

### 4. Composable Primitives Design Pattern
Engine effects must never be card-specific. They must be generic pipeline operations:
* **Inspection Primitive:** Inspect $N$ cards from top/bottom of any zone (`draw_deck`, `discard`, `encounter_deck`).
* **Filtering Primitive:** Partition a card array by predicate (e.g. resource icon, card type, trait) into `{ matched, unmatched }`.
* **Routing Primitive:** Move cards to target destinations (`HAND`, `DISCARD`, `TABLEAU`, `DECK_TOP`, `DECK_BOTTOM`).

---

## Consequences

* **100% Rules Reference v1.8 Adherence:** Cards function exactly as written and officially ruled.
* **Traceable Audit Freshness:** Clear visibility into when cards were modified and audited down to the minute (`HH:mm`).
* **Fail-Safe Containment:** Ambiguous or low-confidence card logic is prevented from polluting the active game engine.
* **Visible, Shrinking Backlog:** The `docs/ambiguities/` directory provides a concrete, file-based Inbox Zero metric for remaining card work.
* **Maximized Code Reuse:** Complex multi-step cards compose from shared generic primitives.
