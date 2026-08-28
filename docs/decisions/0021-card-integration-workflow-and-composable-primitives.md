# ADR-0021: Standard Card Integration Protocol, Blast-Radius Guardrails, Audit Metadata & Inbox-Zero Ambiguity Tracking

## Status
Accepted

## Context & Problem Statement
When digitizing card games with extensive card pools like Marvel Champions, five distinct failure modes frequently arise:
1. **Runaway Refactors:** AI agents or developers attempting to support complex cards by rewriting core engine subsystems without authorization.
2. **Ad-Hoc Interpretation / Guesswork:** Developers informally guessing or assuming card interactions, misinterpreting exact scopes (e.g. conflating *Villain Schemes* with *Minion Schemes*, or missing identity resource timings).
3. **Infinite Refinement Loops:** Attempting to force-fit ambiguous cards without a hard boundary leads to endless revision cycles.
4. **Card-Specific Monolithic Logic ("Spaghetti Code"):** Writing custom one-off engine functions for each individual card leads to code bloat, fragility, and inability to scale across 1,000+ cards.
5. **Lack of Audit Lifecycle Tracking:** Without timestamps and review metadata, it is impossible to know when a card was last verified against new rules or if recent changes were audited.

To guarantee fidelity to **Marvel Champions Rules Reference v1.8** and maintain architectural stability, we establish clear blast-radius guardrails, a 3-tier change classification, batch-resilient ambiguity isolation, and encapsulated audit tracking.

---

## Decision

We establish the **8-Step Card Integration Protocol**, **3-Tier Blast-Radius Guardrails**, **Batch-Resilient Ambiguity Queue**, and **Encapsulated Audit Tracking**:

### 1. Blast-Radius Refactor Guardrails (3-Tier Classification)
* **Tier 1 (Fast-Track — Direct Execution):** Supplemental JSON edits, adding enum/union literals (`TriggerType`, `EffectType`), adding `case` branches to existing switch dispatchers, adding unit tests.
* **Tier 2 (Additive Generic Helpers — Permitted with 0 Regressions):** Adding pure generic utility functions in `src/engine/effects/` (e.g. deck inspection, stack filtering). All existing tests must pass with zero regressions.
* **🛑 Tier 3 (Structural Refactor Gate — Mandatory Plan & User Approval):** Modifying core state schemas (`GameState`, `PlayerState`, `CardInstance`), refactoring phase loops in `villain-phase.ts`, altering action dispatch contracts, or rewriting major subsystems.
  * **In Single-Card Mode:** Stop immediately, log to `docs/ambiguities/`, create `implementation_plan.md`, and wait for explicit user approval before touching source code.
  * **In Batch-Mode (Scanning multiple cards / sets):** **Do not halt the batch.** Log a dedicated ambiguity file to `docs/ambiguities/{pack}_{code}_{slug}.md` with `blocker_category: "TIER_3_STRUCTURAL_REFACTOR"`, skip the blocked card, continue scanning all remaining cards in the set, and present a consolidated report + implementation plan at the end of the batch run.

### 2. The 8-Step Integration Protocol
Every card added or refined must follow these exact sequential steps:
1. **Ingest Upstream Text:** Read exact printed text from `data/upstream/`.
2. **Literal Semantic Mapping:** Identify timing, triggers, costs, targets, and form constraints without interpretation.
3. **Draft Supplemental Schema & Audit Block:** Define explicit `audit` (`createdAt`, `updatedAt`, `reviewedAt`, `rulesVersion`, `confidence`), `abilities`, `timing`, `trigger`, `cost`, `effect`, `params`, and `tags`.
4. **Consult Ground Truth (`references/`):** Check `references/rules_reference_v18.md` and MarvelCDB FAQs (`https://marvelcdb.com/faqs`). Apply **The Golden Rule** (Card text overrules general rules).
5. **Bidirectional Round-Trip Test & Circuit-Breaker:** Translate supplemental code back into human language. Proceed only if confidence is $\ge 95\%$.
   * **Max 3 Refinement Iterations:** If confidence remains $< 95\%$ after 3 attempts, **ABORT** integration and generate a blocked card report in `docs/ambiguities/{pack}_{code}_{slug}.md`.
6. **Engine Reuse Check:** Check `src/engine/effects/` and `src/engine/triggers/` before authoring new logic.
7. **Author Composable Generic Primitives & Blast-Radius Check:** If extending the engine, build generic reusable building blocks. If Tier 3 is required, gate behind approval or batch isolation.
8. **Stamp Audit (HH:MM), Codify Specs, Sort Keys & Prune Ambiguity:** Stamp ISO timestamps (`YYYY-MM-DDTHH:mm`), populate `mechanicSteps` in JSON, sort supplemental JSON keys canonically by ascending card ID (`01001a` -> `01001b` -> `01002`), document specs in `docs/specs/card-mechanics-breakdown.md`, and **delete the corresponding ambiguity file** in `docs/ambiguities/` upon successful resolution (Inbox Zero).

### 3. Encapsulated Audit Metadata Schema
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

### 4. Inbox Zero Ambiguity Queue (`docs/ambiguities/`)
* Each blocked card generates its own dedicated file: `docs/ambiguities/{pack}_{card_code}_{slug}.md`.
* Files contain YAML frontmatter (`card_code`, `card_name`, `confidence_reached`, `blocker_category`) and forensic failure details.
* As developers resolve blockers, files are deleted. An empty directory signifies 100% engine compatibility.

---

## Consequences

* **Architectural Safety:** Core state machines and interfaces are protected against unauthorized structural rewrites.
* **Batch Efficiency:** Set-wide reviews scan 100% of cards without stopping, identifying cross-cutting architectural needs for consolidated implementation.
* **100% Rules Reference v1.8 Adherence:** Cards function exactly as written and officially ruled.
* **Visible, Shrinking Backlog:** The `docs/ambiguities/` directory provides a concrete, file-based Inbox Zero metric for remaining card work.
