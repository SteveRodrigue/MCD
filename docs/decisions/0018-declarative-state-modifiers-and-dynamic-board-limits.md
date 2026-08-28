# ADR-0018: Declarative State Modifiers, Dynamic Board Limits & Zero Card-Code Coupling

## Status
Accepted

## Context
In card game engine architecture, checking specific card IDs (e.g. `if (card.code === '01073')` for *The Triskelion*, `if (card.code === '01008')` for *Web-Shooter*, `if (card.code === '01084')` for *Nick Fury*) introduces tight coupling, brittleness, and technical debt. As new heroes, allies, scenarios, and encounter sets are added, hardcoded branching becomes unmaintainable.

Per the MCD architectural mandate, all game rules must be derived strictly from:
1. **The Core Rules Machine (Marvel Champions Rules Reference v1.8)**.
2. **Declarative Supplemental Metadata (`src/data/supplemental/`)**.
3. **Reusable Effect Functions / Trigger Handlers**.

---

## Decision

We establish the **Zero Card-Code Coupling Principle**:

### 1. Zero Hardcoded Card IDs in Engine Logic
No file in `src/engine/` (except test suites or starter deck definitions) may contain `card.code === '01xxx'` checks.

### 2. Dynamic Board Limits & State Modifiers
All player limits and board parameters are derived dynamically from state queries scanning active `CONSTANT` abilities:
* **Ally Limit (`getPlayerAllyLimit`):**
  * Base: $3$ allies.
  * Queries in-play cards for `timing: "CONSTANT"`, `effect: "ALLY_LIMIT_BONUS"`.
  * When a card granting an ally limit bonus leaves play (e.g. *The Triskelion* is discarded), if the player exceeds their new limit, the engine enforces immediate discard down to legal capacity.
* **Hand Size Limit (`getPlayerHandSizeLimit`):**
  * Base: active identity printed `handSize`.
  * Queries in-play cards for `HAND_SIZE_BONUS` (e.g. *Symbiote Suit*).

### 3. Generic Counter & Generator Architecture
* In-play resource generators are identified by `card.enrichment?.uses` (having counters) or abilities with `timing: "RESOURCE"` or `effect: "GENERATE_RESOURCE"`.
* Spending a counter decrements `tokens.counters`.
* When counters reach $0$, if `card.enrichment?.uses?.discardOnEmpty === true`, the card is automatically discarded to player discard.

### 4. Trigger-Driven Round End & Consequential Damage
* **Round-End Discards (e.g. Nick Fury):** Driven by declarative `timing: "FORCED_RESPONSE"`, `trigger: "ROUND_END"`, `effect: "DISCARD_SELF"`.
* **Consequential Damage Exceptions (e.g. Black Cat):** Driven by declarative `consequentialDamage?: { attack?: number; thwart?: number }` or `noConsequentialAttack: true` on `CardEnrichment`.
* **Stat Buffs on Attack / Thwart (e.g. Jessica Jones):** Driven by `timing: "CONSTANT"`, `effect: "THW_BONUS_PER_SIDE_SCHEME"`.

### 5. Complex Scenario Mechanics
If a future Scenario introduces a truly novel mini-game mechanic that cannot be composed via standard primitives, that logic will reside in a **named specialized effect function** registered in `src/engine/effects/` rather than hardcoded in the core dispatch loops.

---

## Consequences
* **Extensibility:** New cards with existing mechanics (e.g. *Avengers Tower* granting ally limit, *Knowhere* granting ally limit) work instantly with zero engine code changes.
* **Maintainability:** The rules engine remains a pure, decoupled state reducer.
* **Testability:** State queries and modifier functions can be tested with arbitrary mock cards.
