# [ADR-0046] Universal Declarative Card Filtering Architecture

- **Status:** Accepted
- **Date:** 2026-09-06
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In Marvel Champions LCG, card targeting and filtering is one of the most fundamental operations across both player and encounter actions:
- Searching decks/discards for specific cards (e.g. *Tony Stark* Futurist looks for `Tech` cards; *Ancestral Knowledge* searches discard for `Black Panther` cards).
- Discarding cards with criteria (e.g. *Caught Off Guard* discards an `upgrade` or `support`; treachery effects discarding cards until a `minion` or `hazard` is revealed).
- Dynamic stat calculations and hand size modifiers (e.g. *Tony Stark* hand size equals 5 + 1 per `Tech` upgrade in play).
- Playing/putting cards into play (e.g. *Make the Call* playing an `ally` from any discard pile; Nemesis setup spawning specific minions/side schemes).
- Orientations and ready/exhaust primitives (e.g. ready an `Avenger` ally; exhaust a `Tech` support).

Currently in MCD, filtering logic is fragmented across multiple disparate locations:
1. `src/engine/effects/index.ts:matchCardFilter` contains a partial card filter implementation used by `SEARCH_AND_SELECT`.
2. `src/engine/pipeline/stat-calculator.ts` contains hardcoded regexes and ad-hoc trait matching for `MODIFY_HAND_SIZE`.
3. `src/engine/effects/index.ts:executeDiscard` manually checks `cardTypes` or `type` on tableau cards, ignoring traits, aspects, or costs.
4. `src/engine/game-setup.ts` manually checks trait/type matching during setup abilities.
5. `src/engine/effects/index.ts:PUT_INTO_PLAY` manually checks `set: "PLAYER_NEMESIS"` and card types.

Furthermore, `FilterSchema` in `src/data/supplemental/schema.ts` has grown opportunistically with flat, non-composable fields (`type`, `type_code`, `types`, `cardTypes`, `trait`, `traits`, `aspect`, `aspects`, `zone`, `isUnique`, `targetCardCode`, `targetCardCodes`, `costMin`, `costMax`, `hasKeyword`). Many effect schemas (`SearchAndSelectParamsSchema`, `DiscardParamsSchema`, `ExhaustReadyParamsSchema`) duplicate or flatten these parameters inconsistently.

We need a universal, declarative card filtering architecture where:
- Any effect primitive (`DISCARD`, `SEARCH_AND_SELECT`, `MODIFY_HAND_SIZE`, `PUT_INTO_PLAY`, `READY`, `EXHAUST`, etc.) can accept the exact same filter specification.
- Filter criteria can be extended or tweaked in the future without modifying or breaking any of the consuming effect primitives.
- Card supplemental authors and the Card Editor have a single, unified, well-documented specification for all filterable attributes.

---

## Decision Drivers

1. **Extensibility & Decoupling:** Adding a new filter criterion (e.g. resource icons, printed HP, status tokens, faction) or tweaking existing logic must only require updating the filter evaluation module and schema—never touching `DISCARD`, `SEARCH_AND_SELECT`, `MODIFY_HAND_SIZE`, etc.
2. **Declarative & Data-First (Principle #4):** Filtering logic must reside declaratively in supplemental JSON, strictly validated by Zod at compile-time and runtime.
3. **Zero Tech Debt & Strict Deprecation (No Backwards Compatibility Shims):** We explicitly reject perpetual legacy shims and dual-syntax tech debt. All legacy flat filtering parameters (`targetCardCode`, flat `trait`, flat `type`, loose `cardTypes` in parameters, ad-hoc regex/trait matching) will be completely deprecated and removed. All supplemental card data across the core packs will be migrated and retrofitted to the canonical universal filter definition.
4. **Composability (Boolean Logic):** Rules often require boolean logic (e.g. "an upgrade OR a support", "a non-unique Avenger ally", "cost 3 or less").
5. **Card Editor & GUI Usability:** Filter specifications must map cleanly to schema forms in the Card Supplemental Editor (`ADR-0045`) without requiring raw JavaScript or untyped text inputs.
6. **Zero Raw-Text Parsing (ADR-0019):** Filters evaluate structured card properties (traits, types, costs, keywords, codes, factions), never unstructured narrative prose.

---

## Considered Options

### Option 1: Centralized Monolithic Flat Matcher
Consolidate all filter criteria into a single flat object schema (`UniversalCardFilter`) with all potential filter fields (expanded flat list), and extract `matchCardFilter` from `src/engine/effects/index.ts` into a dedicated pure engine module (`src/engine/filters/card-filter.ts`).

- **Structure:**
  ```json
  {
    "types": ["upgrade", "support"],
    "traits": ["Tech"],
    "aspects": ["leadership"],
    "isUnique": true,
    "costMin": 1,
    "costMax": 3,
    "hasKeyword": "Overkill"
  }
  ```

### Option 2: Composable Predicate Criterion Tree with Strict Universal Schema (Chosen)
Define a single, canonical universal filter schema (`UniversalCardFilterSchema`) centered around an atomic `CardCriteria` model, coupled with boolean combinators (`all`, `any`, `none`). Completely deprecate and remove all loose parameters (`targetCardCode`, `trait`, `type`, `cardTypes`) from individual effect parameters. All supplemental data files (`src/data/supplemental/pack/*.json`) are retrofitted directly to use the canonical `filter: { ... }` structure.

- **Structure:**
  ```typescript
  export interface CardCriteria {
    // Identity & Codes
    codes?: string[];
    names?: string[];
    isIdentitySpecific?: boolean;
    isUnique?: boolean;

    // Classification
    types?: CardType[];
    traits?: string[];
    aspects?: Aspect[];
    sets?: string[];

    // Numbers & Costs
    cost?: NumberComparison;     // { min?: number, max?: number, equals?: number }
    printedAtk?: NumberComparison;
    printedThw?: NumberComparison;
    printedDef?: NumberComparison;
    printedHp?: NumberComparison;
    resourceIcons?: ResourceType[];

    // Keywords & State Flags
    keywords?: Keyword[];
    isExhausted?: boolean;
    hasStatus?: CharacterStatus[];
  }

  export interface UniversalCardFilter extends CardCriteria {
    // Boolean Combinators (Optional for complex queries)
    all?: UniversalCardFilter[]; // Logical AND
    any?: UniversalCardFilter[]; // Logical OR
    none?: UniversalCardFilter[]; // Logical NOT
  }
  ```

Consuming effects uniformly accept `filter?: UniversalCardFilter`. No effect allows ad-hoc filter properties outside of `filter`.

### Option 3: Custom String DSL Query Engine
Implement a query string parser (e.g. `"type:(upgrade OR support) AND trait:Tech AND cost<=2"`).

- **Structure:** Single string expression parsed by a tokenizer/AST evaluator.

---

## Decision Outcome

**Chosen Option:** **Option 2: Composable Predicate Criterion Tree with Strict Universal Schema**

### Rationale ("The Why")
1. **Zero-Touch Extensibility on Consuming Effects:** Consuming effects (`DISCARD`, `SEARCH_AND_SELECT`, `MODIFY_HAND_SIZE`, `PUT_INTO_PLAY`, `READY`, `EXHAUST`) delegate card eligibility to a single pure, card-agnostic function:
   ```typescript
   matchesCardFilter(card: CardView | NormalizedCard, filter: UniversalCardFilter, context?: GameContext): boolean
   ```
   When a new criterion (e.g. `hasStatus: ["STUNNED"]`, `resourceIcons: ["physical"]`, or `countersMin: 2`) is introduced, only `CardCriteria` schema and `matchesCardFilter` are updated. Zero lines of code in `executeDiscard`, `executeSearchAndSelect`, or `calculateStatModifiers` need to change.
2. **Elimination of Technical Debt (Zero Dual-Path Branching):** Rather than carrying runtime transformation shims or supporting multiple ways to express the same filter (e.g. flat `trait` vs `filter.traits`), all legacy parameters are deprecated and eliminated. The supplemental data packs are retrofitted to the clean canonical schema. This ensures zero ambiguity, simpler documentation, easier schema validation, and zero performance penalty.
3. **Expressive Boolean Logic without DSL Overhead:** Option 3 (DSL query strings) introduces grammar maintenance, parser errors, lack of IDE autocomplete, and escaping bugs. Option 2 provides full boolean expressiveness (`any`, `all`, `none`) directly within native JSON, perfectly validated by Zod and visual form fields in the Card Editor.
4. **Card Editor Visual Form Synergy:** Atomic criteria map 1:1 to UI multi-select tag pickers and range inputs in the Card Supplemental Editor (`ADR-0045`), while nested `any` / `all` groups map cleanly to standard rule builder controls.

---

## Evaluation of Options

### Option 1: Centralized Monolithic Flat Matcher
- **Pros:**
  - Simple, flat structure.
  - Easy to implement initially.
- **Cons:**
  - Cannot express complex conditions (e.g. "either an Avenger ally OR an upgrade costing <= 2").
  - Flat namespace becomes cluttered as criteria grow (e.g. `costMin`, `costMax`, `hpMin`, `hpMax`, `thwMin`, etc.).
  - Leaves ambiguity regarding whether multiple traits mean AND or OR.

### Option 2: Composable Predicate Criterion Tree with Strict Universal Schema (Chosen)
- **Pros:**
  - Clean separation: atomic properties evaluate with logical AND, while `any` / `none` handle disjunction and negation.
  - Extremely extensible: new criteria are added to `CardCriteria` without touching any effect primitives.
  - Zero technical debt: legacy flat filtering properties are removed; single canonical schema across the entire codebase.
  - Highly testable: `matchesCardFilter` is a pure, card-agnostic unit with 100% test coverage for all predicates.
- **Cons:**
  - Requires a one-time data retrofit across existing supplemental card JSON files to migrate legacy fields into the new canonical `filter: { ... }` format. (Accepted per user direction to eliminate tech debt).

### Option 3: Custom String DSL Query Engine
- **Pros:**
  - Compact representation in JSON files (single string).
- **Cons:**
  - Requires writing and maintaining a custom parser and tokenizer.
  - Breaks standard JSON Schema autocomplete and live VS Code diagnostics.
  - Harder to render as structured form inputs in the Card Supplemental Editor.
  - Violates ADR-0019 (Strict Metadata-Driven Rules Execution & Zero Raw-Text Parsing).

---

## Consequences

### Positive Consequences
- **Single Source of Truth for Filtering:** All card filtering in the engine will run through `src/engine/filters/card-filter.ts:matchesCardFilter`.
- **Universal Effect Integration:**
  - `DISCARD`: Filters hand, deck, or tableau targets using `filter`.
  - `SEARCH_AND_SELECT`: Filters looked/searched cards using the identical `filter`.
  - `MODIFY_HAND_SIZE`: Computes dynamic hand size bonuses (e.g. per Tech upgrade) using the identical `filter`.
  - `PUT_INTO_PLAY`: Validates target cards in discard/setAside using `filter`.
  - `READY` / `EXHAUST`: Validates eligible targets on the board using `filter`.
  - Dynamic formulas / counters: Dynamic counters (e.g. counting cards in play) reuse `filter`.
- **Dedicated Documentation:** A new comprehensive documentation module (`docs/specifications/supplemental/04_universal_card_filter.md` or dedicated targeting guide) will detail every available filter criterion, syntax, and examples, cross-linked from all effect documentation.
- **Zero Future Effect Refactoring:** Future filter extensions will be 100% localized to `src/engine/filters/` and `src/data/supplemental/schema.ts`.

### Negative Consequences / Risks & Mitigations
- **Supplemental Data Migration Effort:** Existing pack files contain variations of flat `targetCardCode`, `trait`, `type`, and loose `cardTypes` in parameters.
  - *Mitigation:* We write a deterministic migration script/task to audit and retrofit all pack files in `src/data/supplemental/pack/*.json` into the new canonical schema, updating audit metadata (`reviewedAt`, `reviewedBy: "antigravity"`), verified by `npm run report:declarations` and `tests/data/supplemental-schema.test.ts`. Zero legacy shims remain in code.
- **Recursive Zod Schema Typing:** Recursive schemas (`z.lazy`) can require explicit type annotations.
  - *Mitigation:* Explicit TypeScript interfaces (`UniversalCardFilter`) are defined alongside `z.ZodType<UniversalCardFilter>`, ensuring full type safety and IDE autocomplete without runtime slowdown.
