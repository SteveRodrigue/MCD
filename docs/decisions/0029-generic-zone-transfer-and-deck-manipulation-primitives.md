# [ADR-0029] Generic Zone Transfer and Deck Manipulation Primitives

- **Status:** Accepted
- **Date:** 2026-08-31
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In Marvel Champions (RR v1.8 p. 33 "Zone"), card movement across game zones (Play Area, Decks, Discard Piles, Hand, and Set-Aside Area) is a fundamental engine operation.

Previously, complex cards that manipulate game zones—such as _Shadow of the Past_ (`01190`), _Rhino Stage II_ (`01095`), _Make the Call_ (`01071`), and _Ancestral Knowledge_ (`01042`)—often required bespoke, single-use primitives (e.g. `SPAWN_NEMESIS`, `SEARCH_AND_REVEAL_SIDE_SCHEME`, `PLAY_ALLY_FROM_DISCARD`). Hardcoding the source or destination zone into the primitive name (e.g., `PUT_INTO_PLAY_FROM_SET_ASIDE` or `SHUFFLE_INTO_DECK_FROM_SET_ASIDE`) leads to primitive bloat and prevents code reuse.

How should we model card movement and zone transitions across the engine and declarative supplemental data layer?

---

## Decision Drivers

- **Driver 1: Composable & Universal Primitives (ADR-0021):** Eliminate bespoke single-use primitives by parametrizing sources, destinations, and filters.
- **Driver 2: Official Rules Authority (RR v1.8 p. 14, 33):** Support all official card zones (`HAND`, `DECK`, `DISCARD`, `SET_ASIDE`, `PLAY`, `ENGAGED`, `SIDE_SCHEMES`, `TABLEAU`) and lifecycle hooks (entering play, attaching keywords, initial scheme threat, When Revealed triggers).
- **Driver 3: Decoupled Headless Engine (ADR-0002 & ADR-0019):** Keep game logic 100% data-driven without hardcoding card identifiers or titles in engine logic.

---

## Considered Options

1. **Option 1 (Monolithic Primitives):** Create card-specific or zone-specific effect handlers (e.g., `SPAWN_NEMESIS`, `PUT_INTO_PLAY_FROM_SET_ASIDE`, `SHUFFLE_INTO_DECK_FROM_SET_ASIDE`).
2. **Option 2 (Universal Parameterized Semantic Primitives):** Standardize on composable semantic primitives (`PUT_INTO_PLAY`, `SHUFFLE_INTO_DECK`, `TRANSFER_CARD`, `DISCARD_CARDS`) with standardized `{ from, to, filter }` parameters.
3. **Option 3 (Single Generic Transfer Function):** Create a single low-level `TRANSFER_CARD_ZONE` primitive with extensive conditional flags.

---

## Decision Outcome

**Chosen Option:** **Option 2: Universal Parameterized Semantic Primitives (`PUT_INTO_PLAY`, `SHUFFLE_INTO_DECK`, `DISCARD_CARDS`)**

### Rationale ("The Why")

- **Avoids Name Proliferation:** Promoting `from` (source), `to` (destination), and `filter` to parameters means 3 clean primitives can replace dozens of single-use effects across both player and encounter cards.
- **Semantic Lifecycle Resolution:** `PUT_INTO_PLAY` is semantically distinct from simple zone movement because entering play in Marvel Champions triggers automatic rules:
  - Minions check Toughness/Quickstrike and engage targets.
  - Side Schemes calculate starting threat per player and enter the active scheme zone.
  - Allies and Upgrades attach to tableaus and initialize dynamic counters.
- **Immediate Cross-Catalog Reuse:**
  - _Shadow of the Past_ (`01190`): `PUT_INTO_PLAY` (from: `SET_ASIDE`) + `SHUFFLE_INTO_DECK` (from: `SET_ASIDE`, to: `ENCOUNTER_DECK`).
  - _Rhino Stage II_ (`01095`): `PUT_INTO_PLAY` (from: `["DECK", "DISCARD"]`, to: `SIDE_SCHEMES`).
  - _Make the Call_ (`01071`): `PUT_INTO_PLAY` (from: `PLAYER_DISCARD`, to: `TABLEAU`).
  - _Ancestral Knowledge_ (`01042`): `SHUFFLE_INTO_DECK` (from: `PLAYER_DISCARD`, to: `PLAYER_DECK`).

---

## Evaluation of Options

### Option 1: Monolithic / Zone-Specific Primitives

- **Pros:** Simple to write in isolation for a single card.
- **Cons:** High primitive bloat; 0% reuse; violates ADR-0021.

### Option 2: Universal Parameterized Semantic Primitives (Chosen)

- **Pros:**
  - Highly reusable across player cards, encounter treacheries, villain stage transitions, and modular scenario setups.
  - Preserves clean Zod schemas (`ZoneSchema`, `FilterSchema`).
  - Integrates seamlessly with sequential execution (`steps: []`[^steps]) and conditional gates (`gate: "IF_FAILED"`).
- **Cons:**
  - Requires centralized zone resolution helper functions in the engine pipeline.

### Option 3: Single Low-Level Transfer Function

- **Pros:** Single effect string.
- **Cons:** Blurs semantic distinctions; overloaded parameter configurations; hard to maintain.

---

## Consequences

### Positive Consequences

- Decomposes `SPAWN_NEMESIS` and `SEARCH_AND_REVEAL_SIDE_SCHEME` into generic building blocks.
- Unblocks _Make the Call_ (`01071`) and _Ancestral Knowledge_ (`01042`) in the ambiguity queue.

* Card lifecycle entrance and deck shuffling are expressed as declarative primitives rather than card-specific code.[^helpers]

[^helpers]: **Errata (2026-09-02, `documentation-audit`).** This consequence originally read _"Centralizes card lifecycle entrance and deck shuffling mechanics in `src/engine/pipeline/zone-helpers.ts`."_ **No such file exists.** The behaviour is real but distributed: the `PUT_INTO_PLAY` and `SHUFFLE_INTO_DECK` executors live in `src/engine/effects/index.ts`; atomic zone transfer (`removeCardFromAllZones()`, `attachCardToHost()`) landed in `src/engine/state/state-validator.ts` under [ADR-0040](0040-universal-card-conservation-and-atomic-zone-transfer.md); Fisher-Yates `defaultShuffle()` is in `src/engine/state/game-setup.ts`; and discard-into-deck reshuffling is in `src/engine/pipeline/deck-exhaustion.ts`. The bullet has been reworded to state the decision's actual outcome instead of a centralization that never happened.

[^steps]: **Errata (2026-09-02, `documentation-audit`).** This ADR originally wrote `sequence: []`. The array was renamed to `steps: []` by [ADR-0030](0030-unified-ability-step-sequence-architecture.md) ("Standardized Vocabulary (`steps` instead of `sequence`)"); the concept is unchanged — it remains the ordered list of steps executed to resolve a card ability. Verified against `steps: z.array(AbilityStepSchema).min(1)` in `src/data/supplemental/schema.ts` and zero occurrences of `"sequence"` in `src/data/supplemental/pack/*.json`. This decision's substance is unchanged.
