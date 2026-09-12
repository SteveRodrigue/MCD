# [ADR-0052] Centralized Dynamic Formula & State Value Evaluator Engine

- **Status:** Accepted
- **Date:** 2026-09-12
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement
Marvel Champions cards frequently compute dynamic, state-dependent numbers (e.g. *Gamma Slam* deals damage equal to suffered damage up to 15, *Energy Channel* deals damage equal to counters multiplied by 2 up to 10, *Counter-Punch* deals damage equal to hero ATK, *Jessica Jones* scales thwart per side scheme, *Iron Man* scales hand size per Tech upgrade).

Previously, dynamic amounts were implemented in an ad-hoc, fragmented fashion:
1. `amountFormula` string tokens (`'SUFFERED_DAMAGE'`, `'HERO_ATK'`) were defined in `AmountFormulaSchema` and manually branched inside `DEAL_DAMAGE` in `src/engine/effects/index.ts`.
2. Other effect primitives (`REMOVE_THREAT`, `HEAL_DAMAGE`, `ADD_COUNTERS`) relied on a rudimentary `resolveNumericAmount` that only supported a subset of event interception tokens (`INTERCEPTED_VALUE`, `PREVIOUS_RESULT`, `DISCARDED_COUNT`).
3. Ad-hoc string tokens could not express filters (e.g., matching card traits or card types), target selectors, or attribute inspections.
4. Continuing to carry legacy `amountFormula` alongside `DynamicValueSource` created technical debt, dual-branching runtime overhead, and duplicate schema validation.

We need a centralized, card-agnostic dynamic evaluation engine adhering to RR v1.8 calculation rules, eliminating `amountFormula` technical debt, and standardizing all dynamic quantities on `DynamicValueSource`.

---

## Decision Drivers
- **Rules Reference (RR v1.8 p. 11, 31) Compliance:** Calculations must be evaluated at the point of ability resolution, rounded down on fractions (`Math.floor`), and clamped non-negative (`Math.max(0, ...)`).
- **Zero Raw-Text Hardcoding (ADR-0019):** Card-specific formulas and card codes must never be hardcoded into effect primitives.
- **Composable Filtering & Targets (ADR-0046, ADR-0049):** Dynamic values must leverage `UniversalCardFilter` and `TargetSelector` rather than rigid enum strings.
- **Technical Debt Elimination:** Deprecate and remove obsolete string flags (`amountFormula`) in favor of canonical declarative structures across supplemental data and engine execution.

---

## Considered Options
1. **Option 1: Ad-Hoc String Enum Expansion (`amountFormula`)**
   Add new string tokens (`'SIDE_SCHEMES_IN_PLAY'`, `'THREAT_ON_SCHEME'`, `'TABLEAU_COUNT'`, `'DAMAGE_ON_CHARACTER'`) to `AmountFormulaSchema`.
2. **Option 2: Dual-Mode Runtime Compatibility**
   Support both legacy `amountFormula` strings and structured `DynamicValueSource` in parallel with internal aliasing.
3. **Option 3: Complete Technical Debt Elimination & Canonical `DynamicValueSource` Unification**
   Deprecate and remove `AmountFormulaSchema` entirely. Retrofit all supplemental card data (`01019`, `01021`, `01077`) to use `DynamicValueSource`. Centralize all dynamic mathematical evaluations into a dedicated pure engine module `evaluateDynamicAmount`.

---

## Decision Outcome

**Chosen Option:** **Option 3: Complete Technical Debt Elimination & Canonical `DynamicValueSource` Unification**

### Rationale ("The Why")
1. **Clean Declarative Architecture:** `DynamicValueSource` already models composable sources (`ENTITY_COUNT`, `COUNTERS`, `STAT_VALUE`, `CARD_ATTRIBUTE`, `INTERCEPTED_VALUE`, `PREVIOUS_RESULT`) with `multiplier`, `offset`, and `clamp: { min, max }`. Option 1 is incapable of expressing complex filters or target selectors.
2. **Zero Tech Debt:** Carrying `amountFormula` as a second parallel API (Option 2) introduces maintenance burden, schema ambiguity, and dual testing paths. Removing it completely and migrating the small set of existing cards ensures a single, clean path across the entire codebase.
3. **Universal Engine Primitive:** Centralizing the math in `evaluateDynamicAmount` allows all effect types (`DEAL_DAMAGE`, `REMOVE_THREAT`, `HEAL_DAMAGE`, `ADD_COUNTERS`, `MODIFY_STAT`, `MODIFY_HAND_SIZE`) to share identical calculation, rounding, and clamping logic.

---

## Evaluation of Options

### Option 1: Ad-Hoc String Enum Expansion (`amountFormula`)
- **Pros:**
  - Quick to add new string constants.
- **Cons:**
  - Cannot specify filters (e.g. *Tech* upgrades vs *Weapon* upgrades).
  - Cannot specify target selectors or counter types cleanly.
  - Violates ADR-0019 and ADR-0049.

### Option 2: Dual-Mode Runtime Compatibility
- **Pros:**
  - Zero edits required to existing supplemental cards.
- **Cons:**
  - Perpetuates technical debt in both schema and engine.
  - Leaves conflicting ways to declare identical mechanics.
  - Clutters UI card editor schemas.

### Option 3: Complete Technical Debt Elimination & Canonical `DynamicValueSource` Unification
- **Pros:**
  - One clean, unified schema for all scalar values.
  - Fully composable with `UniversalCardFilter` and `TargetSelector`.
  - Adheres strictly to RR v1.8 calculation rules (rounding down, floors, ceilings).
  - Modernizes supplemental data directly.
- **Cons:**
  - Requires updating the 3 Core Set cards currently using `amountFormula` and adjusting associated unit tests.

---

## Consequences

### Positive Consequences
- A single mathematical pipeline resolves all dynamic quantities:
  $$\text{Final Amount} = \max\Big(0, \operatorname{clamp}\big(\lfloor \text{Base Value} \times \text{multiplier} + \text{offset} \rfloor, \, \text{clamp.min}, \, \text{clamp.max}\big)\Big)$$
- All effect types (`DEAL_DAMAGE`, `REMOVE_THREAT`, `HEAL_DAMAGE`, `ADD_COUNTERS`) gain full dynamic state token capabilities.
- Supplemental definitions (`01019`, `01021`, `01077`) are cleaner, more readable, and conform to the modern metadata standard.

### Negative Consequences / Risks & Mitigations
- **Risk:** Existing unit tests referencing `amountFormula` will fail if not updated.
- **Mitigation:** Update test assertions in `suffered-damage-formula.test.ts`, `universal-counter-engine.test.ts`, and `effect-parameter-registry.test.ts` to expect `DynamicValueSource`.
