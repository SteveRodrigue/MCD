# [ADR-0060] Gate and Effect Parameter Separation & Resource Kicker Tracking

- **Status:** Accepted
- **Date:** 2026-09-14
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In Marvel Champions, many cards have abilities that combine conditional execution gates with resolution effects. For example:
- **Resource kickers** (e.g. Photonic Blast `01013`): *"Hero Action (attack): Deal 5 damage to an enemy. If you paid for this card using a [energy] resource, draw 1 card."*
- **Deck discard kickers** (e.g. Hulk `01050`): *"Forced Response: After Hulk attacks, discard the top card of your deck. If that card's printed resource has: [physical] - Deal 2 damage to an enemy..."*
- **Encounter conditional gates** (e.g. Explosion `01111`): *"When Revealed: If Bomb Scare is in play, assign X damage... If Bomb Scare is not in play, this card gains surge."*

Historically, `AbilityStep` in `src/data/supplemental/schema.ts` declared a single `params: Record<string, any>` dictionary. Both gate-controlling parameters (`resource`, `cardCode`, `status`, `targetStepId`) and effect execution parameters (`amount`, `target`, `source`, `filter`) were stored together in this flat bag. This conflation caused several serious issues:
1. **Parameter namespace collisions**: When an effect primitive and a gate both evaluated fields with similar keys (e.g. `target` or `resource`), ambiguous interpretation occurred.
2. **Untracked payment resources**: Resources spent to pay the cost of playing a card (`PLAY_CARD`) were discarded during action dispatch without tracking which specific resources were paid, leaving resource kicker gates like `IF_RESOURCE_MATCH` unable to inspect payment history.
3. **Editor UI confusion**: Card editors had to guess whether a parameter belonged to the conditional gate or the effect primitive, leading to fragile heuristics in visual editors.

---

## Decision Drivers

- **RR v1.8 Resource Kicker Rules Precision**: Adhere strictly to Marvel Champions rules regarding "If you paid for this card using a [resource]" conditions.
- **Zero Tech Debt Invariant**: Eliminate overloaded parameter dictionaries without introducing permanent shims, while maintaining backward-compatible ingestion for legacy data.
- **Declarative Data-First Architecture**: Keep card-specific rules in `src/data/supplemental/` and card-agnostic state machine logic in `src/engine/`.
- **Developer Tooling Usability**: Provide clear, unambiguous schema definitions and visual editor controls for gate parameters vs. effect parameters.

---

## Considered Options

1. **Option 1: Nested Step Hierarchy**: Redesign `AbilityStep` into a nested structure where a gate wraps an inner step payload (`gate: { type, params, step: { effect, params } }`).
2. **Option 2: Flat Dedicated Parameter Separation (`gateParams` and `effectParams`) with Tracked Payment Resources**: Keep `AbilityStep` flat with optional `gateParams` and `effectParams` fields, preserve `params` for ingestion fallback, export canonical accessor helpers (`getStepEffectParams`, `getStepGateParams`), and record `resourcesSpent` on `TriggerContext` during `PLAY_CARD` payment.
3. **Option 3: Custom Effect Primitives per Kicker**: Create unique card-specific effect primitives (e.g. `DEAL_DAMAGE_AND_ENERGY_KICKER_DRAW`).

---

## Decision Outcome

**Chosen Option:** **Option 2: Flat Dedicated Parameter Separation (`gateParams` and `effectParams`) with Tracked Payment Resources**

### Rationale ("The Why")

- **Simplicity and Flat Pipelines**: Marvel Champions card steps execute in sequential pipelines. Retaining a flat step structure (`id`, `gate`, `gateParams`, `effect`, `effectParams`) avoids deep AST nesting while cleanly separating gate configuration from effect parameters.
- **Universal Kicker Evaluation**: Recording `resourcesSpent` from payment cards and resource generators during `PLAY_CARD` cost resolution and passing them into `executeEffect` allows `IF_RESOURCE_MATCH` to evaluate payment kickers universally across all hero and aspect cards.
- **Dual-Mode Resource Matching**: Supports both resource kickers (`context.resourcesSpent`) and card-discard inspection (`context.discardedCards` per Hulk `01050`) within a single declarative gate primitive.
- **Seamless Backward Compatibility**: Accessor helpers `getStepEffectParams(step)` and `getStepGateParams(step)` allow legacy card data using `params` to continue operating during incremental migration without breakage.

---

## Evaluation of Options

### Option 1: Nested Step Hierarchy
- **Pros:**
  - Clear lexical scope between gate and effect.
- **Cons:**
  - Excessive nesting complexity in JSON and TypeScript types.
  - Breaks flat `steps: [...]` pipeline assumptions across all existing engine execution and editor UI code.

### Option 2: Flat Dedicated Parameter Separation (`gateParams` and `effectParams`)
- **Pros:**
  - Clean separation of concerns with zero namespace collisions.
  - Universal accessor helpers make migration completely backward-compatible.
  - Straightforward integration into `StepPipelineEditor` and `DualCardInspector`.
  - Directly models RR v1.8 resource payment requirements.
- **Cons:**
  - Requires maintaining backward-compatible `step.params` fallback until legacy definitions are fully retrofitted.

### Option 3: Custom Effect Primitives per Kicker
- **Pros:**
  - Quick one-off fix for individual cards.
- **Cons:**
  - Violates the Declarative Data-First Invariant and Rule #4 by adding card-specific primitives to the universal engine.
  - Creates combinatorial explosion of ad-hoc primitives across the catalog.

---

## Consequences

### Positive Consequences
- **Photonic Blast & Kicker Cards**: Photonic Blast `01013` is now canonically declared as a 2-step pipeline (`DEAL_DAMAGE` followed by `DRAW` with `gate: "IF_RESOURCE_MATCH"`), resolving 5 damage and drawing 1 card only when paid with an Energy or Wild resource.
- **Hulk & Discard Gates**: Hulk `01050` cleanly separates `gateParams: { resource: ... }` from `effectParams: { amount: ..., target: ... }`.
- **Payment Transparency**: `TriggerContext.resourcesSpent` tracks payment cards, aspect doublers, and generator abilities, propagating cleanly into subsequent trigger dispatch chains (`CARD_PLAYED`, `ENTERS_PLAY`).
- **Visual Editor Precision**: `StepPipelineEditor` provides dedicated input controls for `gateParams` when parameterized gates (`IF_RESOURCE_MATCH`, `IF_ALREADY_HAS_STATUS`, `IF_CARD_IN_PLAY`, `IF_FAILED`) are selected.

### Negative Consequences / Risks & Mitigations
- **Ingestion Dual-Read**: Code paths must use `getStepEffectParams(step)` and `getStepGateParams(step)` instead of raw `step.params`. Mitigated by normalizing `step = { ...step, params: getStepEffectParams(step) }` at the top of `executeStep` and sequence loops, ensuring existing effect handlers remain robust.
