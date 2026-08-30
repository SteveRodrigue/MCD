# [ADR-0024] Declarative Action Cost Engine & State Mutation Pre-Checks

* **Status:** **Accepted**
* **Date:** 2026-08-30
* **Authors:** MCD Core Team
* **Deciders:** User & Antigravity

---

## Context and Problem Statement
In *Marvel Champions*, cards have diverse and composite costs to initiate abilities:
* **Exhaustion:** Exhausting the card itself or the Hero/Alter-Ego identity (*Carol Danvers*, *Peter Parker*, *Web-Shooter*).
* **Direct Damage:** Dealing direct damage to the character as a cost (*War Machine* `01030` takes 2 damage).
* **Card Discard:** Discarding cards from hand, either a fixed number or a variable amount scaling the effect (*Legal Practice* `01023` discards up to 5 cards).
* **Resource & Token Spending:** Spending physical/energy resources or removing counters.
* **Pre-condition Checks:** Rules prohibiting ability usage if the state cannot legally change (e.g. *Carol Danvers* cannot use *Rechannel* if already at maximum health).

Previously, cost checks were either hard-coded into specific actions or scattered ad-hoc inside `action-dispatcher.ts` and `legality-checker.ts`.

---

## Decision Drivers
* **Single Source of Truth:** Centralize cost validation and execution in a dedicated subsystem.
* **Composite Cost Support:** Support cards that combine multiple costs (e.g. Exhaust + Take Damage).
* **Atomic Cost Payment:** If any part of the cost or pre-check fails, no state mutation occurs.
* **Declarative DSL:** Model costs in `src/data/supplemental/` without writing bespoke TypeScript functions per card.

---

## Decision Outcome

**Chosen Option:** **Dedicated Cost Engine (`src/engine/pipeline/cost-engine.ts`) with `canPayAbilityCost` and `executeAbilityCost`.**

### Mechanics:
1. **`canPayAbilityCost(state, player, ability, sourceCardInst, options)`:**
   * Evaluates `costCheck` (e.g. `"CURRENT_HEALTH < MAX_HEALTH"`).
   * Validates ready state for `exhaustSelf` / `exhaustCard`.
   * Checks character HP against `damageHero` (preventing illegal character suicide).
   * Verifies required tokens on `sourceCardInst`.
   * Validates available hand size for `discardCard`.
2. **`executeAbilityCost(state, player, ability, sourceCardInst, options)`:**
   * Applies all deductions atomically and returns metadata (such as `discardedCount` for dynamic scaling).

---

## Consequences

### Positive Consequences
* **Clean Action Dispatcher:** `action-dispatcher.ts` calls `canPayAbilityCost` and `executeAbilityCost` in 4 lines of code rather than dozens of manual `if/else` checks.
* **Immediately Unblocks Multiple Cards:** Resolves *Carol Danvers* (`01010a`), *Legal Practice* (`01023`), *War Machine* (`01030`), and *Tenacity* (`01093`).
* **Zero Code Duplication:** Future cards with discard or damage costs need zero engine TypeScript changes.
