# [ADR-0038] Universal Special Ability Plugin Architecture and Sequential Ordering Engine

- **Status:** Accepted
- **Date:** 2026-09-01
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context

In Marvel Champions (RR v1.8 p. 28 "Special"), "Special" abilities represent unique, non-standard activation sequences that can only be triggered when explicitly commanded by another card effect:

1. **Black Panther (_Wakanda Forever!_ `01043`):** Triggers the Special ability of each controlled Black Panther upgrade (_Energy Daggers_, _Panther Claws_, _Tactical Genius_, _Panther Suit_) in the player's chosen sequential order, applying enhanced **Finisher Bonuses** to the final step.
2. **Doctor Strange (_Invocation Deck_):** Resolves custom spells (_Crimson Bands of Cyttorak_, _Seven Rings of Raggadorr_, _Vapors of Valtorr_) as Special actions.
3. **Storm / Phoenix / Fan-Made Custom Heroes:** Implement modular sequence chains, weather deck rotations, and psionic powers.

Embedding complex multi-card execution pipelines and interactive reordering algorithms directly into the monolithic `effects/index.ts` switch statement creates architectural coupling, bloats the core primitive engine, and hinders the integration of fan-made content and future expansion heroes.

## Decision

We establish a dedicated **Special Ability Plugin Registry** in `src/engine/specials/` that decouples hero-specific and scenario-specific Special ability mechanics from the universal headless primitive dispatcher:

1. **Standardized Plugin Contract (`SpecialAbilityHandler`):**
   ```typescript
   export interface SpecialAbilityHandler {
     id: string; // e.g. 'WAKANDA_FOREVER', 'INVOCATION_DECK'
     validatePlayCondition: (
       state: GameState,
       context: EffectExecutionContext,
     ) => boolean;
     execute: (
       state: GameState,
       context: EffectExecutionContext,
       payload?: any,
     ) => EffectResult;
   }
   ```
2. **Dedicated Modular Directory (`src/engine/specials/`):**
   - `special-registry.ts`: Singleton registry providing `registerSpecialHandler()`, `getSpecialHandler()`, and default registrations.
   - `wakanda-forever.ts`: Encapsulated Black Panther upgrade sequencing, play condition validation ($\ge 1$ upgrade in tableau), dynamic finisher bonus scaling ($N$-th step boost), and interactive order prompt generation.
3. **Universal Effect Primitive Delegation:**
   - `effects/index.ts` exposes a card-agnostic primitive `EXECUTE_SPECIAL` (and aliased `EXECUTE_WAKANDA_FOREVER`) that resolves through `getSpecialHandler(specialId)`.
4. **Interactive Sequential Ordering Modal:**
   - When a sequence involves player choice over multiple items, the engine enqueues a decision prompt (`WAKANDA_FOREVER_SEQUENCE_ORDER`), rendering an interactive Drag & Drop / Left-to-Right reordering modal (`WakandaForeverModal.tsx`) with a reference card tooltip on the left and dynamic Finisher highlighting on the right.

## Consequences

### Positive

- **Complete Decoupling:** Core primitive dispatcher (`effects/index.ts`) remains 100% card-agnostic and clean.
- **Fan-Made & Expansion Extensibility:** Any custom hero or expansion mechanic with a unique Special pipeline can be added in a single isolated file under `src/engine/specials/` without touching engine core.
- **Isolated Testability:** Each Special module can be tested with dedicated unit tests in `tests/engine/`.
- **Enhanced Player Ergonomics:** Full visual control over sequence ordering via intuitive drag-and-drop modal.

### Negative

- Requires a registration step during engine initialization (handled cleanly in `special-registry.ts`).

---

## Addendum (2026-10-04, Issue #207): resumable special sequences

Each Special is an **ordered step**, so a step that needs a decision must finish it before any later step runs. A synchronous loop cannot do that (a later step such as Panther Claws used to resolve before the player answered Energy Daggers' "choose a player" prompt, wrongly changing Tough interactions).

- `GameState.pendingSpecialSequence` (`specialId`, `playerId`, `remainingUpgradeIds`, optional targets) holds the steps still to resolve, by instance id, in order.
- `SpecialAbilityHandler` gains an optional `resume`. The Wakanda handler resolves one upgrade at a time; if a step opens a prompt and steps remain, it saves them and returns.
- `dispatchAction` resumes a pending sequence after any successful action once the prompt queue is empty (`resumePendingSpecialSequence` in `special-registry.ts`).
- The finisher bonus is fixed by list position (the last step), unchanged. Prompt-free sequences and the single-upgrade path resolve immediately and leave no pending state.
- The card-coded fallbacks for `01047`-`01049` were removed: all four upgrades declare a `SPECIAL` ability in supplemental data.
- Step failures inside `executeSequence` remain swallowed engine-wide (tracked in #225).

