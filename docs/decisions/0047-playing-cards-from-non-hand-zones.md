# [ADR-0047] Playing Cards From Non-Hand Zones and Dynamic Target Play Costs

- **Status:** Accepted
- **Date:** 2026-09-06
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In Marvel Champions, cards are normally played from a player's hand (`RR v1.8 p. 19`). However, several key cards modify this rule:
1. *Make the Call* (`01071`): Action event that targets an ally in any player's discard pile, pays its printed cost, and puts it into play.
2. *Lockjaw* (`05018`): Ally that can be played directly from the discard pile during the player's turn.
3. *Magik* (`45030a`), *Daredevil* (`60001a`): Playing the top card of a deck as if it were in hand.
4. *Jocasta* (`26013`), *Black Panther* (`23012`), *Avengers Compound* (`58034`): Playing an event/ally attached to or tucked under a host as if in hand.
5. *Valkyrie* (`25001a`), *The Bifrost* (`25023`), *Calling in Favors* (`61008`): Action that searches for or targets a card outside hand and plays it (with optional cost modifiers).

Previously, MCD had a placeholder primitive `PLAY_ALLY_FROM_DISCARD` that did not mutate state or validate costs, and `canPlayCard()` strictly asserted `player.hand.find(...)`.
How should MCD model playing cards from non-hand zones and paying dynamic target costs?

---

## Decision Drivers

- **Driver 1: Composable & Universal (Principle #4, ADR-0021, ADR-0046):** Avoid card-specific primitives like `PLAY_ALLY_FROM_DISCARD`. Support any zone (`DISCARD`, `DECK`, `TUCKED`, `SET_ASIDE`) with standard `UniversalCardFilter`.
- **Driver 2: Single Source of Truth for Card Play & Costs (RR v1.8 p. 19):** Playing a card must use the unified `canPlayCard()` and payment mechanics (resource generation, unique checks, ally limit checks, restricted checks, on-play triggers).
- **Driver 3: Multi-Hero & Cross-Player Scoping:** *Make the Call* specifies *"any player's discard pile"*. Primitives must support multi-player search pools.
- **Driver 4: Clean User Experience (Pop-Art UI & Prompt Queue):** When a card offers multiple candidate targets (e.g. 3 allies in discard), the player must be prompted to choose, calculate the corresponding cost, and pay. When target and payment are pre-supplied (e.g. by bots or direct UI selection), execution should be atomic.

---

## Considered Options

1. **Option 1 (Single Dedicated `PLAY_CARD_FROM_ZONE` Primitive + Prompt Resolution):**
   - Introduce a generic primitive `PLAY_CARD_FROM_ZONE` with parameters:
     `{ source: 'PLAYER_DISCARD' | 'ANY_PLAYER_DISCARD' | 'PLAYER_DECK', filter: UniversalCardFilter, costMode: 'PRINTED_COST' | 'FREE' | 'REDUCED', destination: 'TABLEAU' }`.
   - Queues a prompt for target selection, then handles payment.
   - *Limitation:* Does not cover passive permissions (e.g. *Lockjaw*, *Magik*).

2. **Option 2 (Multi-Step Ability Sequence: Search $\to$ Pay $\to$ Put Into Play):**
   - Compose `SEARCH_AND_SELECT` $\to$ `PAY_PRINTED_COST` $\to$ `PUT_INTO_PLAY`.
   - *Limitation:* Breaks Marvel Champions cost arrow ($\to$) semantics and atomic rollback if a player cannot afford the chosen ally.

3. **Option 3 (Generalized Play Zone Permission & Universal `PLAY_CARD_FROM_ZONE` Primitive - Chosen):**
   - **Pillar A (Passive Play Permissions):**
     Extend `canPlayCard` and `PlayCardAction` to accept an optional `sourceZone?: 'HAND' | 'PLAYER_DISCARD' | 'ANY_PLAYER_DISCARD' | 'DECK_TOP' | 'ATTACHED' | 'TUCKED'` and `targetOwnerPlayerId?: string`. If granted, `canPlayCard()` checks that zone instead of strictly `player.hand`.
   - **Pillar B (Active Targeted Card Play Primitive):**
     Create a universal declarative primitive `PLAY_CARD_FROM_ZONE`:
     Supports both atomic execution (when target & payment are provided) and interactive `PendingDecisionPrompt` queuing (when target needs to be chosen).

---

## Decision Outcome

**Chosen Option:** **Option 3: Generalized Play Zone Extension (`canPlayCard`) + Declarative `PLAY_CARD_FROM_ZONE` Primitive**

### Rationale ("The Why")
- **Separation of Concerns:** *Make the Call* is an Action Event that initiates an out-of-hand play with a dynamic cost. *Lockjaw* is an Ally with a permission to be played from discard. Option 3 provides the exact tools for both without hacky workarounds.
- **Immediate Cross-Catalog Reuse:** Perfectly supports Core Set *Make the Call* (`01071`) now, while laying the groundwork for *Lockjaw* (`05018`), *The Bifrost* (`25023`), *Calling in Favors* (`61008`), *Jocasta* (`26013`), and *Magik* (`45030a`).
- **Eliminates Tech Debt:** Deprecates and removes `PLAY_ALLY_FROM_DISCARD` from the schema and engine entirely.

---

## Evaluation of Options

### Option 1: Dedicated Active-Only Primitive
- **Pros:** Handles *Make the Call* well.
- **Cons:** Leaves passive cards like *Lockjaw* unable to play from discard.

### Option 2: Multi-Step Ability Sequence
- **Pros:** Reuses smaller steps.
- **Cons:** Breaks cost arrow atomicity and cannot validate cost legality before initiating.

### Option 3: Two-Pillar Architecture (Chosen)
- **Pros:**
  - 100% unified code path for card legality, cost payment, and entrance.
  - Covers both active event card plays and passive zone permissions.
  - Zero code duplication between hand play and non-hand play.
- **Cons:**
  - Requires updating `canPlayCard` and `action-dispatcher` to handle non-hand lookups.

---

## Consequences

### Positive Consequences
- *Make the Call* (`01071`) is fully implemented and operational across solo and multi-hero setups.
- `PLAY_ALLY_FROM_DISCARD` is cleanly removed.
- Future cards (*Lockjaw*, *The Bifrost*, *Magik*) have a verified architectural pattern ready to use.

### Negative Consequences / Risks & Mitigations
- *Multi-hero card ownership:* When an ally owned by Player 2 is played by Player 1 via *Make the Call*, the ally enters play under Player 1's control, but upon defeat returns to Player 2's discard pile (RR v1.8 p. 18 "Ownership").
  - *Mitigation:* Explicitly tracked via `ownerId?: string` on `CardInstance` in `src/engine/models/state.ts`. All defeat and discard pipelines (`ALLY_ATTACK`, `ALLY_THWART`, `combat-pipeline.ts`, `round-upkeep.ts`, `effects/index.ts`) route the card to `owner.discard`, fully satisfying RR v1.8 p. 11.
