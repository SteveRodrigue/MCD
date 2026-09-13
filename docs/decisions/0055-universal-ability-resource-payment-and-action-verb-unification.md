# [ADR-0055] Universal Ability Resource Payment & Action Verb Unification

- **Status:** Accepted
- **Date:** 2026-09-13
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In Marvel Champions (RR v1.8), cards often feature printed action abilities with explicit resource costs (e.g., *Hero Action: Spend 3 [physical] resources → discard this card* on Enhanced Ivory Horn `01100`, or *Alter-Ego Action: Exhaust Superhuman Law Division and spend 1 [mental] resource → remove 2 threat from a scheme* on `01026`).

Previously, the engine introduced an ad-hoc action type `SPEND_RESOURCES_TO_DISCARD_ATTACHMENT` specifically for discarding attachments. This created multiple architectural defects:
1. **Ad-hoc Action Verb Proliferation:** Creating specific action verbs like `SPEND_RESOURCES_TO_DISCARD_ATTACHMENT` leaks a card's specific outcome into the engine state machine and violates the Declarative Data-First Invariant.
2. **Cost Engine Decoupling & Free Discard Bug (Issue #108):** Because `SPEND_RESOURCES_TO_DISCARD_ATTACHMENT` was isolated from the standard `executeAbilityCost` and `canPayAbilityCost` pipeline, cards like Enhanced Ivory Horn could be discarded without validating payment, without checking player form, or for free if no payment cards were provided.
3. **Player Agency Violation:** In Marvel Champions rules, resource payment requires the player to choose and select which hand cards or generators to commit. Automatic, arbitrary, or missing payment violates player agency.

How should in-play card abilities requiring resource costs—including attachment discard abilities—be structured in the engine and presented to the player?

---

## Decision Drivers

- **Marvel Champions Rules Reference (RR v1.8 p. 5, 11, 15, 25):** Strict rules compliance where discard actions are card abilities with costs (`cost.resourceCost`), form timings (`HERO_ACTION`), and cost arrows (`→`).
- **Declarative Data-First Invariant:** Supplemental data defines the card ability (`cost.resourceCost` + `DISCARD (source: SELF)`); the engine remains card-agnostic and uses universal primitives.
- **Player Agency & Selection:** The player must always be prompted to choose which cards/generators to spend.
- **Simplicity & Zero Tech Debt:** Eliminate bespoke action verbs in favor of universal existing action types.

---

## Considered Options

1. **Option A: Unify under `USE_CARD_ABILITY` (Universal In-Play Card Ability Activation)**
   - Retire `SPEND_RESOURCES_TO_DISCARD_ATTACHMENT`.
   - Generalize card discovery in `USE_CARD_ABILITY` to search all in-play entities (attachments on Villain, Identity, Minions, Allies, and Schemes).
   - Add `paymentCardInstanceIds` and `generatorInstanceIds` to `UseCardAbilityAction`.
   - Route any ability with `cost.resourceCost > 0` through `CardPaymentModal` before dispatching `USE_CARD_ABILITY`.
2. **Option B: Generic `PAY_RESOURCES_AND_RESOLVE_ABILITY` Action**
   - Introduce a new generic payment action type alongside `USE_CARD_ABILITY`.
3. **Option C: Retain and Patch `SPEND_RESOURCES_TO_DISCARD_ATTACHMENT`**
   - Keep the bespoke action verb and patch resource checking inside its dedicated 130-line handler.

---

## Decision Outcome

**Chosen Option:** **Option A: Unify under `USE_CARD_ABILITY`**

### Rationale ("The Why")
1. **Direct Alignment with Rules Reference (RR v1.8):** In official rules, paying to discard an attachment is nothing more than activating an in-play card ability. It is not an engine action verb.
2. **Eliminates Code Duplication:** `USE_CARD_ABILITY` already handles timing validation, limit tracking, cost execution, and effect execution (`DISCARD source: SELF`). Generalizing card lookup makes every card with an ability across the entire 170-pack catalog work identically.
3. **Strict Player Selection Invariant:** When an ability has a resource cost, the UI opens `CardPaymentModal`, requiring the player to select cards providing matching resource types before confirming. The engine validates that `paymentCardInstanceIds` cover the cost, guaranteeing 100% rules precision.

---

## Evaluation of Options

### Option A: Unify under `USE_CARD_ABILITY`
- **Pros:**
  - 100% reusable across all attachments, upgrades, supports, allies, and identity cards.
  - Zero technical debt: removes 130 lines of bespoke handler code.
  - Consistent UI integration: all paid abilities use the same payment modal flow.
- **Cons:**
  - Requires updating existing tests that referenced the legacy action type.

### Option B: Generic `PAY_RESOURCES_AND_RESOLVE_ABILITY`
- **Pros:**
  - Separates paid actions from unpaid actions.
- **Cons:**
  - Creates redundant parallel action types with overlapping responsibilities.

### Option C: Patch `SPEND_RESOURCES_TO_DISCARD_ATTACHMENT`
- **Pros:**
  - Minimal changes to existing test signatures.
- **Cons:**
  - Permanent technical debt; requires inventing future ad-hoc verbs (e.g. `SPEND_RESOURCES_TO_BOOST_ALLY`).

---

## Consequences

### Positive Consequences
- Retires `SPEND_RESOURCES_TO_DISCARD_ATTACHMENT`, simplifying the engine's action union.
- Fixes Issue #108 by enforcing resource validation, typed resource matching (physical/wild), and hero form checks.
- All Core Set cards with resource costs (`01100`, `01018`, `01026`, `01036`, `01066`, `01072`, `01093`) now operate on the exact same unified, declarative architecture.

### Negative Consequences / Risks & Mitigations
- *Risk:* Legacy tests might expect `SPEND_RESOURCES_TO_DISCARD_ATTACHMENT`.
- *Mitigation:* Retain a lightweight forwarder in `action-dispatcher.ts` that maps legacy calls to `USE_CARD_ABILITY` while updating tests to the canonical form.
