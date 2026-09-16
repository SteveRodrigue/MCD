# [ADR-0061] Declarative Next-Card Cost Reduction Aura Architecture

- **Status:** Accepted
- **Date:** 2026-09-15
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In Marvel Champions (RR v1.8, "Cost", "Resource", "Modifiers"), several cards and effects alter the cost of playing subsequent cards rather than generating immediate resources. A prime Core Set example is Helicarrier (`01092`):
> **Action**: Exhaust Helicarrier → choose a player. The next card that player plays this phase costs 1 fewer resource.

Prior to this decision, the engine only supported direct resource generation (`GENERATE_RESOURCE`), static modifiers for cards already in play (`costModifiers`), and payment through resource discarding. Temporary, phase-bound, single-use cost-reduction auras applied to future card plays were unrepresented in the player state and cost evaluation pipeline. Furthermore, under RR v1.8 (p. 7 & 17), cost reductions are applied to the next qualifying card played—even if that card has a printed cost of 0 (which consumes the reduction without saving resources)—and clear at the end of the phase.

How do we model, track, evaluate, display, and consume transient cost reduction auras declaratively and deterministically without hardcoding card-specific logic into the engine?

---

## Decision Drivers

- **RR v1.8 Fidelity:** Strictly adhere to official timing, scope (player + phase/round limit), 0-cost card consumption rules, and multi-modifier stacking order.
- **Declarative Supplemental Invariant:** Model all card behavior exclusively in `src/data/supplemental/` via typed schemas (`ReduceNextCardCostParamsSchema`), leaving the engine card-agnostic.
- **Single Source of Truth:** Centralize effective cost calculation in `src/engine/pipeline/cost-engine.ts` (`getEffectiveCardCost`), ensuring legality checks (`canPlayCard`), action dispatch (`PLAY_CARD`), and UI modals (`CardPaymentModal`) share identical cost logic.
- **Comic Pop-Art UX:** Present clear visual feedback in `CardPaymentModal` (pop-art discount badge, strikethrough printed cost, and an alert/caution banner when playing a 0-cost card that will consume the reduction).
- **Multiplayer Support:** In solo mode, resolve Helicarrier directly onto the active player; in multiplayer (`state.players.length > 1`), route through the universal decision prompt queue to allow choosing the target player.

---

## Considered Options

1. **Option 1: Ad-hoc pseudo-resource generation.** Treat cost reduction as a virtual floating resource added to the player's resource pool until used.
2. **Option 2: Imperative card-specific hooks in action dispatcher.** Hardcode card code `01092` inside `action-dispatcher.ts` when playing cards.
3. **Option 3: First-class `ActiveCostReduction` array on `PlayerState` with declarative params and centralized cost evaluation.** Add typed `activeCostReductions` to `PlayerState`, populated by `REDUCE_NEXT_CARD_COST` effect steps, evaluated via `getEffectiveCardCost()`, and pruned automatically on phase transitions and card play.

---

## Decision Outcome

**Chosen Option:** **Option 3: First-class `ActiveCostReduction` array on `PlayerState` with declarative params and centralized cost evaluation.**

### Rationale ("The Why")

Option 3 maintains complete engine-data decoupling and satisfies all RR v1.8 timing requirements:
- Virtual resources (Option 1) break resource requirement rules (e.g., cards requiring specific resource types like physical or mental cannot be paid with untyped "cost reductions", but cost reductions reduce the total quantity needed prior to paying specific types).
- Hardcoding card IDs (Option 2) violates the Declarative Data-First Invariant.
- Option 3 provides a universal, composable foundation not just for Helicarrier, but for any future card modifying next-card costs with specific filters (e.g. aspect, card type, trait) and durations (`PHASE`, `ROUND`).

---

## Evaluation of Options

### Option 1: Ad-hoc pseudo-resource generation
- **Pros:**
  - Reuses existing floating resource mechanisms.
- **Cons:**
  - Violates RR v1.8: cost reductions modify the card's cost *before* resource payment, affecting effects that check "if you paid for this card using only [type] resources".
  - Fails to model 0-cost consumption properly.

### Option 2: Imperative card-specific hooks in action dispatcher
- **Pros:**
  - Fast to write for a single card.
- **Cons:**
  - Violates the Declarative Data-First Invariant.
  - Fragile and unmaintainable across expansions.

### Option 3: First-class `ActiveCostReduction` array on `PlayerState`
- **Pros:**
  - Clean schema typing in `src/data/supplemental/schema.ts` (`ReduceNextCardCostParamsSchema`).
  - Strict immutability and testability across `cost-engine.ts`, `legality-checker.ts`, and `action-dispatcher.ts`.
  - Automatic phase cleanup in `player-phase.ts`, `villain-phase.ts`, and `round-upkeep.ts`.
  - Clean UI presentation with reactive discount indicator and 0-cost consumption warning.
- **Cons:**
  - Requires updating `PlayerState` type definition and serializable state copies.

---

## Consequences

### Positive Consequences
- Helicarrier (`01092`) works fully out of the box in solo and multiplayer games.
- Any future card reducing the cost of the next card played (with optional filters on card type, faction, or trait) can be integrated with 100% declarative JSON.
- Both engine tests and UI modal tests cleanly verify cost deduction, legality, and banner presentation.

### Negative Consequences / Risks & Mitigations
- *Risk:* Multiple stacked cost reductions could be consumed simultaneously on a single card play.
  *Mitigation:* `action-dispatcher.ts` consumes all applied reductions upon successful play and clamps effective cost to minimum 0.
- *Risk:* Forgotten phase expiration leaving stale reductions across rounds.
  *Mitigation:* Expiration hooks installed in all phase end / cleanup pipelines.
