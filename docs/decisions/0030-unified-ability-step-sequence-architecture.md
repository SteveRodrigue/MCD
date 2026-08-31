# ADR-0030: Unified Ability Step Sequence Architecture and Supplemental Data Normalization

* **Status:** Accepted
* **Date:** 2026-08-31
* **Authors:** Antigravity (Software Architect) & MCD Core Team
* **Deciders:** User & Antigravity

---

## Context and Problem Statement

In Marvel Champions Digital (MCD), card behavior is declared through supplemental enrichment data (`src/data/supplemental/`) and executed by the decoupled headless rules engine (`src/engine/`).

With the introduction of [ADR-0028](0028-declarative-effect-sequencing-and-conditional-gates.md), multi-step card abilities (such as "Then" effects, fallback surge triggers, and multi-operation actions) were enabled via a nested `sequence?: CardAbility[]` array on `CardAbility`.

However, the current schema and engine models suffer from structural duality and type coupling:
1. **Polymorphic Dual-Mode Ability Schema:** A `CardAbility` is either a *direct leaf effect* (containing `effect` and `params`) or a *composite parent node* (containing `sequence` and omitting `effect`).
2. **Type Identity Confusion (`CardAbility` vs `AbilityStep`):** `sequence` is typed recursively as `CardAbility[]`. Consequently, individual sub-steps in a sequence are forced to define top-level ability properties like `timing: "ACTION"` or `trigger`, even though sub-steps are merely internal execution primitives with gates, not standalone triggered abilities.
3. **Ambiguity & Invalid States:** The current schema permits invalid states (e.g., specifying both top-level `effect` and `sequence`, or neither). The engine silently resolves this with priority branching (`if (ability.sequence?.length)`).
4. **Engine Duality:** The engine maintains two paths: direct effect execution and sequential step dispatching.

We need to evaluate whether **always having a sequence (mandatory `steps` / `sequence` for all abilities)** is superior, assess its impact on engine architecture and data consistency, explore alternate designs, and define the architectural direction.

---

## Decision Drivers

* **Rules Precision & Conceptual Integrity (RR v1.8):** A card ability is the game-level boundary (Timing, Trigger, Cost, Limits, Errata), whereas an effect sequence is the operational execution pipeline (Steps, Gates, Filters, Params).
* **Schema Rigidity & Type Safety:** Eliminate invalid schema states (e.g., dual definition of `effect` and `sequence`).
* **Engine Simplicity & Pipeline Determinism:** Reduce branching paths in `executeEffect` / `executeAbility`.
* **Authoring Developer Experience (DX):** Minimize unnecessary boilerplate in JSON while maintaining readability and tooling support.
* **Backward Compatibility & Blast Radius:** Ensure existing supplemental cards can migrate cleanly without breaking test suites or existing cards.

---

## Considered Options

1. **Option 1: Mandatory Unified `steps: AbilityStep[]` with Distinct Types (Strict Decoupling)**
   * Every `CardAbility` contains an array of 1 or more `AbilityStep` objects (`steps: [ { effect: "...", params: { ... } } ]`).
   * Eliminate top-level `effect`, `params`, `gate` from `CardAbility`.
   * Separate `CardAbility` (Trigger/Cost/Timing boundary) from `AbilityStep` (Execution/Gate/Params primitive).

2. **Option 2: Schema Discriminated Union (`AtomicAbility` vs `SequentialAbility`)**
   * Keep both forms valid in TypeScript/Zod via a discriminated union:
     * `AtomicAbility` has `effect`, `params`, but no `sequence`.
     * `SequentialAbility` has `sequence: AbilityStep[]`, but no `effect`.

3. **Option 3: Authoring Flexibility with Ingestion Normalization (Canonical Internal Model)**
   * JSON authors can write either simple flat abilities (`effect`, `params`) OR multi-step sequences (`sequence` / `steps`).
   * Zod / Supplemental Loader automatically transforms and normalizes all abilities into canonical `steps: AbilityStep[]` when ingested into the engine runtime.

---

## Architectural Evaluation & Comparison

| Criterion | Current State | Option 1: Mandatory Unified Steps | Option 2: Discriminated Union | Option 3: Ingestion Normalization |
| :--- | :--- | :--- | :--- | :--- |
| **Schema Uniformity** | ❌ Poor (Recursive overlap) | ⭐ **Exceptional (100% consistent)** | 🟡 Moderate (Two valid shapes) | 🟢 High (Canonical in engine) |
| **Engine Code Simplicity** | 🟡 Two execution branches | ⭐ **Single unified step pipeline** | 🟡 Two execution branches | ⭐ **Single unified step pipeline** |
| **Type Safety & Separation** | ❌ Sub-steps carry dummy `timing` | ⭐ **`CardAbility` ≠ `AbilityStep`** | 🟢 Decoupled types | 🟢 Decoupled types |
| **Authoring Conciseness (JSON)** | 🟢 Concise for 1-step cards | 🟡 2-3 extra lines for 1-step cards | 🟢 Concise for 1-step cards | 🟢 Concise for 1-step cards |
| **Refactor / Migration Effort** | N/A | 🟡 Moderate (All JSON cards updated) | 🟢 Low (Only TypeScript/Zod types) | 🟢 Low (Loader transform + types) |

---

## Deep-Dive Analysis of the Proposed Core Changes

### 1. Does "Always Having a Sequence" Make Supplemental Data More Consistent?
**Yes, decisively.**

In domain-driven card game architecture:
* **The Ability Header (`CardAbility`):**
  Defines *when* and *under what conditions* the ability may be initiated.
  * `id`: Unique identifier.
  * `timing`: `ACTION`, `HERO_ACTION`, `FORCED_INTERRUPT`, `RESPONSE`, `WHEN_REVEALED`, etc.
  * `trigger`: Event filter (`VILLAIN_INITIATES_ATTACK`, `MINION_DEFEATED`, etc.).
  * `cost`: Resource cost, exhaust self, discard, hero damage.
  * `limit`: `ONCE_PER_ROUND`, `maxPerRound`.
* **The Execution Pipeline (`AbilityStep[]`):**
  Defines *what mutations occur sequentially*:
  * `id?`: Step identifier.
  * `effect`: The declarative primitive (`DRAW_CARDS`, `DEAL_DAMAGE`, `HEAL_DAMAGE`, `TRIGGER_SURGE`, etc.).
  * `params`: Atomic parameters (`amount`, `target`, `status`).
  * `gate`: Condition gate (`ALWAYS`, `THEN`, `IF_AMOUNT_ZERO`, `IF_ALREADY_HAS_STATUS`, etc.).
  * `filter`: Dynamic target filter.

Under this model:
* A simple ability (e.g. Spider-Man's Spider-Sense) is simply a sequence of **1 step**:
  ```json
  {
    "id": "spider_sense",
    "timing": "INTERRUPT",
    "trigger": "VILLAIN_INITIATES_ATTACK",
    "steps": [
      { "effect": "DRAW_CARDS", "params": { "count": 1, "target": "SELF" } }
    ]
  }
  ```
* A multi-step ability (e.g. Split Personality) is a sequence of **2 steps**:
  ```json
  {
    "id": "split_personality",
    "timing": "ACTION",
    "steps": [
      { "id": "flip", "effect": "FLIP_FORM" },
      { "id": "draw", "effect": "DRAW_UP_TO_HAND_SIZE", "gate": "THEN" }
    ]
  }
  ```

### 2. Would It Change Anything in the Engine?
**Yes, it simplifies and unifies the execution engine:**

1. **Elimination of Polymorphic Duality:**
   * `executeEffect` no longer needs an outer `if (ability.sequence?.length)` branch.
   * Every ability dispatch resolves through `executeAbility(state, ability, context)`:
     1. Verify timing, trigger, and pay costs.
     2. Pass `ability.steps` directly into `executeSequence(state, ability.steps, context)`.
     3. Iterate through `steps`, evaluating gates and threading `previousResult`.
2. **Decoupled Step Semantics:**
   * Step resolution does not require dummy timing/trigger checks.
   * Result accumulation, logging, and onomatopoeia chaining (`"DRAW ➔ SURGE!"`) behave identically for 1-step and $N$-step cards.
3. **Performance:**
   * Array iteration over a 1-element array in modern JS engines takes sub-nanosecond time. Performance impact is completely negligible.

---

## Evaluation of Options

### Option 1: Strict Mandatory `steps` Everywhere (JSON + Engine)
* **Pros:**
  * Maximum conceptual clarity: 1 single canonical representation across documentation, schemas, JSON, and engine.
  * Cleanest TypeScript types: Zero union types or optional fallback properties.
  * Perfect alignment with Card Integration Protocol Step 3 & 4.
* **Cons:**
  * Requires a bulk migration of all cards in `core.json` and `core_encounter.json`.
  * Adds slight verbosity (`steps: [...]`) to simple single-line effects.

### Option 2: Discriminated Union (`AtomicAbility | SequentialAbility`)
* **Pros:**
  * Keeps 1-step JSON definitions concise (`effect` at top level).
  * Enforces compile-time schema safety (cannot have both `effect` and `sequence`).
* **Cons:**
  * Perpetuates two distinct object shapes throughout the engine codebase (`if ('sequence' in ability)`).
  * Sub-steps in `sequence` still require a separate `AbilityStep` definition anyway.

### Option 3: Ingestion Normalization (Canonical Engine `steps` + Flexible Authoring)
* **Pros:**
  * Best of both worlds in DX: Card authors can write flat `effect` + `params` OR `steps: [...]` in JSON.
  * The Zod preprocessor / supplemental loader automatically transforms `{ effect, params }` into `{ steps: [{ effect, params }] }`.
  * The Engine runtime (`src/engine/`) operates purely on the clean, unified `CardAbility { steps: AbilityStep[] }` model with 100% uniformity.
  * Zero immediate breaking change for existing JSON supplemental packs while enabling progressive migration.
* **Cons:**
  * The raw JSON files may have two stylistic variations until standardizing toolings format them.

---

## Architectural Recommendation & Decision Outcome

**Recommended Decision:** **Option 1 (with Option 3 as the ingestion transition bridge)**

### Key Decisions:
1. **Model Decoupling (`CardAbility` vs `AbilityStep`):**
   * Formally define `AbilityStep` containing `id?`, `effect`, `params?`, `gate?`, `filter?`.
   * Redefine `CardAbility` containing `id`, `timing`, `trigger?`, `cost?`, `limit?`, `errata?`, and `steps: AbilityStep[]` (replacing recursive `sequence: CardAbility[]`).
2. **Unified Engine Pipeline:**
   * All ability resolution flows through a single `executeAbility(state, ability)` -> `executeSequence(state, ability.steps)`.
3. **Standardized Vocabulary (`steps` instead of `sequence`):**
   * Use `steps: AbilityStep[]` on `CardAbility` to clearly convey that an ability is composed of sequential steps.
   * Reserve the word "Sequence" for the execution engine function (`executeSequence`) and context (`SequenceExecutionContext`).
4. **Zod Preprocessing / Ingestion Normalizer:**
   * Update `CardAbilitySchema` to accept legacy `{ effect, params }` or `{ sequence: [...] }` and normalize into `steps: AbilityStep[]`, ensuring 100% backward-compatibility and zero test breakage during migration.
5. **Progressive Supplemental Alignment:**
   * Migrate `src/data/supplemental/pack/*.json` to the standard `steps: AbilityStep[]` structure as part of the Card Integration Protocol.

---

## Consequences

### Positive Consequences
* **Single Mental Model:** Card abilities are consistently structured as Trigger/Cost Header + Execution Steps.
* **Zero Polymorphism in Engine:** Engine effect dispatching is strictly linear and unified.
* **Elimination of Dummy Sub-Step Timings:** Sub-steps only declare what they execute and under what gate.
* **Extensible Multi-Step Composition:** Complex card mechanics (e.g. "Do X. If you do, do Y, otherwise do Z") fit naturally into the pipeline without schema hacks.

### Negative Consequences / Risks & Mitigations
* **Migration Overhead:** Existing supplemental JSON files will need normalization.
  * *Mitigation:* Zod `.transform()` normalizer ensures that unmigrated JSON files load and validate seamlessly while files are updated.
* **Schema Documentation Updates:** `docs/specifications/` and `docs/guidelines/` must document `AbilityStep` and `steps: []`.
  * *Mitigation:* Enforce through Mandatory Post-Task Protocol and Card Integration Protocol.
