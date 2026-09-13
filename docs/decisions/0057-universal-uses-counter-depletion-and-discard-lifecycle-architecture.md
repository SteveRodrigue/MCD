# [ADR-0057] Universal Uses (X) Counter Depletion and Discard Lifecycle Architecture

- **Status:** Accepted
- **Date:** 2026-09-13
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

Under the official Marvel Champions Rules Reference (RR v1.8 p. 30), the **Uses (X)** keyword governs cards that enter play with a finite number of counters:
> *"When a card with the uses keyword enters play, place X counters on it, of the specified type. When a card with uses has no counters on it, discard it."*

Conversely, cards that enter play with counters *without* the "Uses" keyword—most notably Hawkeye (Core Set 01066: *"Hawkeye enters play with 4 arrow counters on him."*)—do not discard when empty; they remain in play as valid allies with 0 counters, retaining full basic attack, thwart, and defense capabilities until defeated through damage or consequence.

Prior to this architecture, counter depletion and the subsequent discard lifecycle were fragmented across disparate engine subsystems:
1. **Bespoke Generator Splice in `action-dispatcher.ts`:** In `PLAY_CARD` generator resolution (lines 1173–1181), tapping a card with uses counters decremented only `tokens.counters` and performed an ad-hoc `player.tableau.splice()`. It bypassed atomic zone removal (`removeCardFromAllZones`), failed to cascade attachments or cards placed underneath to discard piles, failed to respect card ownership (`ownerId`), failed to dispatch the mandatory `CARD_DISCARDED` trigger, and omitted comic log attribution.
2. **Missing Discard Step in `executeAbilityCost`:** When an in-play card spent its final counter via `cost.spendCounters` (e.g. Tac Team 01056, Med Team 01080), `executeAbilityCost` decremented counters but did not execute the discard check. It required each external caller to remember to call `checkAndDiscardZeroCounterCard` manually.
3. **Trigger Prompt Queue Blind Spots:** When optional triggers or responses spending counters resolved via the decision prompt queue (`prompt-queue.ts`), calling `executeAbilityCost` did not discard empty cards, creating subtle state desynchronization bugs if a card's last counter was spent inside a prompt callback.
4. **Scattered Implementation & Module Hierarchy:** `checkAndDiscardZeroCounterCard` was situated inside `src/engine/effects/index.ts`, creating potential circular dependency hazards between `cost-engine.ts`, `trigger-dispatcher.ts`, and `effects/index.ts`.

A unified, centralized, and card-agnostic lifecycle architecture is required to guarantee atomic card conservation, attachment cascading, trigger dispatching, and strict non-discard rules enforcement.

---

## Decision Drivers

- **RR v1.8 Rules Fidelity:** Strictly enforce RR v1.8 p. 30 "Uses (X)" discard rules while honoring non-discard exceptions (e.g. Hawkeye 01066 with `discardOnEmpty: false`).
- **Atomic Card Conservation (ADR-0040):** Ensure cards leaving play are removed atomically via `removeCardFromAllZones`, avoiding phantom duplicates in play or discard.
- **Attachment & Tucked Card Cascading (RR v1.8 p. 5, 6):** Ensure any attachments and cards tucked underneath an exhausted uses host card are cleanly routed to encounter or player discard piles.
- **Trigger Integrity (ADR-0048, ADR-0050):** Ensure the `CARD_DISCARDED` trigger is dispatched with correct player and source card attribution whenever a uses card is discarded.
- **Comic Pop-Art Presentation (ADR-0004, ADR-0009):** Emit structured comic log events (`card.discarded.uses_exhausted`) with vibrant onomatopoeia (`USES EXHAUSTED!`).
- **Clean Architecture & Zero Cycles:** Centralize depletion discard in the cost pipeline without introducing circular import cycles between `cost-engine.ts`, `trigger-dispatcher.ts`, and `effects/index.ts`.

---

## Considered Options

1. **Option 1: Centralize `checkAndDiscardZeroCounterCard` in `cost-engine.ts` with Re-export in `effects/index.ts`**
   Place `checkAndDiscardZeroCounterCard` directly in `src/engine/pipeline/cost-engine.ts`. Call it automatically in `executeAbilityCost` whenever `cost.spendCounters` depletes counters to 0, and call it in `action-dispatcher.ts` generator processing. Cascade attachments and tucked cards using an internal loop to avoid circular dependencies with `effects/index.ts`. Re-export `checkAndDiscardZeroCounterCard` from `src/engine/effects/index.ts` for backward compatibility.
2. **Option 2: Status Quo with Caller-Driven Discard Calls**
   Leave `checkAndDiscardZeroCounterCard` in `effects/index.ts` and require every subsystem (`action-dispatcher.ts`, `prompt-queue.ts`, `trigger-dispatcher.ts`) to manually invoke it after executing ability costs.
3. **Option 3: Event-Driven Reactive Observer**
   Emit a `COUNTERS_MODIFIED` trigger and rely on an observer trigger listener to inspect every card after every counter mutation and trigger discard if zero counters remain.

---

## Decision Outcome

**Chosen Option:** **Option 1: Centralize `checkAndDiscardZeroCounterCard` in `cost-engine.ts` with Re-export in `effects/index.ts`**

### Rationale ("The Why")

- **Encapsulated Cost Execution:** Ability costs in Marvel Champions are atomic (RR v1.8 p. 7 "Cost"). Depleting the final counter of a card with "Uses" is part of paying the cost; the card immediately exhausts its utility and leaves play. Encapsulating this inside `executeAbilityCost` ensures that whether an ability is paid via `USE_CARD_ABILITY`, a triggered response, or an interactive decision prompt in `prompt-queue.ts`, the card lifecycle is consistently and automatically finalized.
- **Elimination of Fragmented Logic:** Replacing bespoke inline array splices in `action-dispatcher.ts` with `checkAndDiscardZeroCounterCard` guarantees that resource generators (such as Web-Shooter 01008) trigger `CARD_DISCARDED`, cascade attachments, route to the correct owner's discard pile, and produce comic log entries.
- **Strict Non-Discard Guard:** By inspecting `cardInstance.card.enrichment?.uses?.discardOnEmpty === false` at the very top of `checkAndDiscardZeroCounterCard`, cards like Hawkeye (01066) are guaranteed to never be inadvertently discarded, even when their counters hit 0.
- **Clean Module Hierarchy:** Cascading attachments via an inline loop within `cost-engine.ts` prevents importing `effects/index.ts`, creating a clean DAG: `effects` -> `cost-engine`, while `trigger-dispatcher` and `cost-engine` only share safe runtime function dependencies without top-level evaluation cycles.

---

## Evaluation of Options

### Option 1: Centralize in `cost-engine.ts` with Re-export in `effects/index.ts` (Selected)
- **Pros:**
  - 100% automated lifecycle: `executeAbilityCost` handles discard without external caller boilerplate.
  - Fixes generator counter discard in `action-dispatcher.ts` to follow atomic card conservation and trigger dispatch.
  - Zero circular dependency issues.
  - Backwards-compatible: existing callers of `effects/index.ts` continue to function without disruption.
  - Idempotent: checks whether the card is already in a discard pile before attempting removal and trigger dispatch.
- **Cons:**
  - Minor duplication of attachment discard loop logic, mitigated by localized helper functions.

### Option 2: Status Quo with Caller-Driven Discard Calls
- **Pros:**
  - No changes to `cost-engine.ts`.
- **Cons:**
  - High defect rate: developers and future ability additions will inevitably omit manual discard calls.
  - Fails to fix decision prompt queue activations where `executeAbilityCost` is called without manual discard checks.
  - Bespoke generator slice in `action-dispatcher.ts` remains broken and out of compliance with ADR-0040.

### Option 3: Event-Driven Reactive Observer
- **Pros:**
  - Decouples cost deduction from card removal.
- **Cons:**
  - Increases trigger depth and event recursion risk (ADR-0053).
  - Can cause timing priority inversions where a card with 0 counters remains in play during nested interrupt windows before the observer fires.
  - Harder to trace and debug compared to deterministic procedural pipelines.

---

## Consequences

### Positive Consequences

- **Guaranteed Rules Invariants:** Every Uses card (Web-Shooter, Tac Team, Med Team) reliably transitions from tableau to owner discard when its last counter is spent, firing `CARD_DISCARDED` triggers and producing onomatopoeic comic logs.
- **Protected Non-Uses Cards:** Hawkeye and any future cards with counters but no discard requirement remain safely in play with 0 counters.
- **Attachment Cascading:** When a host card with uses is discarded, any attachments or cards underneath are cleanly discarded per RR v1.8 p. 5, 6.
- **Robust Prompt Queue Integration:** Optional triggers and interrupt responses resolved through the decision queue automatically discard exhausted cards without caller overhead.

### Negative Consequences / Risks & Mitigations

- **Risk: Duplicate Discard Invocations:** If both `executeAbilityCost` and an external caller (e.g. `USE_CARD_ABILITY`) invoke `checkAndDiscardZeroCounterCard`, a card could theoretically be discarded twice.
  - *Mitigation:* Implement an early return guard in `checkAndDiscardZeroCounterCard`: if the card is already present in `player.discard` or `encounterDiscard`, return `false` immediately.
