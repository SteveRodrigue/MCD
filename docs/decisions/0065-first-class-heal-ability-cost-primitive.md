# [ADR-0065] First-Class Declarative Heal Ability Cost Primitive & Card Editor UI Support

- **Status:** Accepted
- **Date:** 2026-09-17
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In the Supplemental Card Editor UI (`/editor`), there was no UI control or declarative schema structure to define healing costs before the arrow (`→`) as specified by Marvel Champions Rules Reference (RR v1.8 p. 11, 16). Previously, an ad-hoc string check (`costCheck: "CURRENT_HEALTH < MAX_HEALTH"`, introduced in ADR-0024) was used on Captain Marvel (`01010a`).

This had two major limitations:
1. **Opaque & Non-Composable:** `costCheck` was an arbitrary string without schema-enforced parameters (`amount`, `target`).
2. **Missing State Mutation in Cost Resolution:** RR v1.8 dictates that healing before the arrow is an atomic cost that must both be legal (character has damage) and be paid by executing the heal. The legacy `costCheck` only checked that `player.health < maxHealth` but did not execute the heal during `executeAbilityCost`.

We need a first-class declarative primitive for heal costs across the schema, headless engine, card catalog, and Card Editor UI.

---

## Decision Drivers

- **Rules Reference (RR v1.8 p. 11 & 16):** Adhere strictly to the official rules where healing before the arrow is an atomic cost that requires sufficient damage and heals the character upon payment.
- **Principle 4 (Declarative Data-First Invariant):** Formalize the cost model cleanly in `AbilityCostSchema` (`heal: { amount: number, target?: 'SELF' | 'TARGET' }`).
- **Principle 6 (Zero Tech Debt Invariant):** Completely purge legacy `costCheck` across schema, engine, and supplemental data rather than carrying backwards-compatibility shims.
- **Presentation Decoupling & Tooling:** Card Editor UI (`AbilityCostSection.tsx`) must expose full interactive controls for adding, editing, and removing heal costs.

---

## Considered Options

1. **Option 1:** Retain `costCheck: string` and add editor inputs for string expressions.
2. **Option 2:** Introduce first-class `heal: { amount: number, target?: 'SELF' | 'TARGET' }` in `AbilityCostSchema`, integrate validation & execution into `cost-engine.ts`, remove `costCheck`, and add a dedicated Heal Cost sub-form in `AbilityCostSection.tsx`.

---

## Decision Outcome

**Chosen Option:** **Option 2: First-Class Declarative Heal Ability Cost Primitive**

### Rationale ("The Why")

In Marvel Champions (e.g. Captain Marvel *Rechannel*, *Momentum Shift*, *What Doesn't Kill Me*, *Battlefield Benevolence*), healing before the arrow is an atomic cost. Option 2 accurately models both the precondition check (ensuring current damage >= required heal amount) and the atomic cost execution (healing the damage and emitting the cost log event). Removing `costCheck` eliminates tech debt and unifies the cost system.

---

## Evaluation of Options

### Option 1: Retain `costCheck` String
- **Pros:**
  - Zero schema change.
- **Cons:**
  - Fragile string parsing.
  - Doesn't execute the heal during cost resolution.
  - Hard to build safe UI form controls.

### Option 2: First-Class `heal` Cost Primitive
- **Pros:**
  - 100% rules-accurate (RR v1.8 p. 11, 16).
  - Strongly typed and validated via Zod (`AbilityCostSchema`).
  - Automatically executes heal in `executeAbilityCost`.
  - Seamlessly supported by Card Editor UI with amount spinner and target selector.
- **Cons:**
  - Requires updating schema, engine, card data, and UI component.

---

## Consequences

### Positive Consequences

- Declarative and type-safe representation of healing costs.
- Engine accurately enforces that characters must have at least `amount` damage before ability activation.
- Card Editor UI allows full editing and inspection of heal costs.
- Purged legacy `costCheck`, maintaining zero tech debt.

### Negative Consequences / Risks & Mitigations

- Any card relying on `costCheck` had to be retrofitted (`01010a` was the only card; updated and verified).
