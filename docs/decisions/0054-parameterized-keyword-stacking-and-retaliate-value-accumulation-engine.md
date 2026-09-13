# [ADR-0054] Parameterized Keyword Stacking & Retaliate Value Accumulation Engine

- **Status:** Accepted
- **Date:** 2026-09-12
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

Per Marvel Champions Rules Reference (RR v1.8 p. 24 "Retaliate"):
> "After a character with the retaliate X keyword is attacked, it deals X damage to the attacking character."
> "If a character has multiple instances of retaliate, the values of each instance are added together."
> "If a character with retaliate X is defeated by the attack, retaliate does not trigger."
> "An attack must deal damage in order for retaliate to trigger" (or character must be attacked and survive).

Prior to this decision, Retaliate value resolution across the headless rules engine suffered from several key deficiencies:
1. **Ad-Hoc and Fragmented Calculations:** Retaliate checks were manually coded in `combat-pipeline.ts` (scanning hero and tableau), partially coded in `effects/index.ts` (scanning only `minion.card`), and missing in `action-dispatcher.ts` when resolving basic and ally attacks against retaliating enemies.
2. **Technical Debt in Supplemental Declarations:** Retaliate was often encoded as an unstructured string token (e.g. `"keyword": "Retaliate 1"`) rather than a structured declarative parameter object with explicit keyword name and magnitude.
3. **Incomplete Stacking Support:** Upgrades and attachments granting Retaliate (e.g., *Dauntless*, *Electrostatic Armor*, or *Concussion Blasters*) were not dynamically aggregated across all character types (Hero, Ally, Minion, Villain).

How should parameterized keywords and Retaliate value accumulation be formally modeled, stacked, and evaluated across all characters and combat timing windows?

---

## Decision Drivers

- **Driver 1: Marvel Champions Rules Reference (RR v1.8 p. 24):** Strict adherence to official rules governing retaliate accumulation, survival requirements, and attack-only triggers.
- **Driver 2: Zero Technical Debt in Declarative Supplemental Data:** Supplemental card definitions must use canonical structured parameter objects (`{ keyword: "Retaliate", amount: 1 }`) rather than unstructured string concatenation.
- **Driver 3: Single Source of Truth for Character Retaliate:** Centralize all dynamic character retaliate calculations into a single universal engine function (`getEffectiveRetaliate(entity, state?)`).
- **Driver 4: Headless Decoupling & Universal Character Parity:** The same calculation and triggering rules must apply symmetrically to Heroes, Allies, Minions, and Villains.
- **Driver 5: Backward Compatibility for External Card Ingestion:** The engine parser must transparently handle legacy strings from raw upstream cards (e.g. MarvelCDB imports) while keeping project supplemental data clean.

---

## Considered Options

1. **Option 1: Ad-Hoc Inline Loops in Each Timing Window:** Keep the current approach of writing custom loops over cards, tableau, and attachments wherever an attack finishes.
2. **Option 2: Token-Based Keyword Mutation on Card Instances:** Mutate `cardInstance.keywords` directly in state upon attachment play, and read the mutated array.
3. **Option 3: Centralized Dynamic Retaliate Accumulator with Canonical Structured Modeling:**
   - Define canonical structured parameter schema `{ keyword: string | Keyword, amount?: number }` for `GRANT_KEYWORD`.
   - Rewrite all supplemental data definitions to the canonical format (zero technical debt).
   - Provide engine normalization helper `parseKeywordItem` for upstream raw strings.
   - Centralize dynamic value accumulation into `getEffectiveRetaliate(entity, state?)` in `stat-calculator.ts`.
   - Hook `getEffectiveRetaliate` into Step 7 enemy attacks (Hero and Ally defenders), basic attacks, ally attacks, and attack effect primitives.

---

## Decision Outcome

**Chosen Option:** **Option 3: Centralized Dynamic Retaliate Accumulator with Canonical Structured Modeling**

### Rationale ("The Why")
Option 3 provides a clean, robust, and rules-faithful architecture:
- Supplemental data is completely freed from technical debt: all card abilities declare exact, strongly typed parameter schemas.
- Centralizing calculations in `stat-calculator.ts` aligns with existing engine patterns (`getEffectiveHeroStats`, `getEffectiveVillainStats`, `getEffectiveAllyStats`), ensuring all modifiers (base card keywords, enrichment keywords, constant abilities, attachments, and tableau upgrades) are dynamically summed in one place without stale cache or state synchronization issues.
- Step 7 combat resolution and player action dispatchers share the exact same calculation primitive, guaranteeing full symmetry across Heroes, Allies, Minions, and Villains.

---

## Evaluation of Options

### Option 1: Ad-Hoc Inline Loops
- **Pros:**
  - Quick localized changes without refactoring helpers.
- **Cons:**
  - High risk of divergence between combat pipeline, action dispatcher, and effect resolution.
  - Symmetrical rules for allies and attachments get skipped or improperly implemented.
  - High maintenance burden and code duplication.

### Option 2: Token-Based Keyword Mutation
- **Pros:**
  - Direct read from `entity.keywords`.
- **Cons:**
  - Violates the headless immutable state model; breaks undo/replay and serializability.
  - Requires fragile cleanup hooks when attachments or upgrades leave play or are blanked.

### Option 3: Centralized Dynamic Retaliate Accumulator with Canonical Structured Modeling
- **Pros:**
  - Strict compliance with RR v1.8 p. 24 value addition invariant.
  - Zero technical debt in supplemental data (`core.json` and `core_encounter.json`).
  - Seamless support for stacking multiple instances across base card + attachments + upgrades.
  - Transparent backward compatibility for raw upstream cards.
- **Cons:**
  - Requires updating multiple call sites in combat and action pipelines to reference the new centralized helper.

---

## Consequences

### Positive Consequences
- Dynamic Retaliate accumulation is 100% testable and verified across all entity types.
- Hero, Ally, Minion, and Villain retaliate mechanics behave identically and predictably.
- Supplemental definitions are unified under clean Zod validation with 0 technical debt.

### Negative Consequences / Risks & Mitigations
- *Risk:* Performance impact of scanning tableau and attachments during combat resolution.
- *Mitigation:* In-play tableau and attachment arrays are small ($< 15$ cards per player, $< 5$ per enemy), making dynamic linear evaluation sub-microsecond and deterministic.
