# [ADR-0080] Canonical Step Gates, Typed Result Facts, and Sequential Context Continuity

- **Status:** Accepted
- **Date:** 2026-10-07
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In Marvel Champions Digital, multi-step card abilities (e.g. *Relentless Assault*, *Clear the Area*, *Shadow of the Past*, *Chase Them Down*) execute sequentially through `executeSequence` in `src/engine/effects/index.ts`. Previously, conditional step execution was governed by two disparate, loosely typed mechanisms introduced across earlier iterations (notably ADR-0030 and ADR-0049):
1. **Ad-Hoc Gate Taxonomy**: Seventeen disparate gate values in `ConditionGate` (e.g., `THEN`, `IF_PREVIOUS_SUCCESS`, `IF_AMOUNT_ZERO`, `IF_ZERO_HEALED`, `IF_FAILED`, `IF_ALREADY_HAS_STATUS`, `IF_CONDITION_MET`, `IF_CONDITION_NOT_MET`, `IF_CARD_IN_PLAY`, `IF_CARD_NOT_IN_PLAY`, etc.).
2. **Dual-Condition Redundancy**: Steps frequently declared both a `condition` string (e.g. `SCHEME_EMPTY`, `ZONE_EMPTY`) and a gate (e.g. `IF_CONDITION_MET`), splitting intent across two properties.
3. **Lossy Binary Result Representation**: Step resolution outcomes were reduced to a boolean `conditionMet?: boolean` and a numeric `value?: number`. If an effect dealt damage, caused defeat, and generated excess damage simultaneously, this multifaceted outcome could not be represented without loss or ad-hoc overrides (such as overwriting `value` with excess damage).
4. **Context Destruction on Skipped Steps**: When a middle step skipped because its gate was closed, downstream steps that referenced `PREVIOUS_TARGET` or `PREVIOUS_RESULT` could break or lose track of previously targeted entities.
5. **Lack of Compile-Time Gate Parameter Validation**: Gate parameters (`gateParams`) were weakly typed, allowing arbitrary or missing parameters without schema errors.

How do we unify step gating into a minimal, canonical taxonomy with strictly validated parameters, rich milestone facts, and deterministic execution context preservation?

---

## Decision Drivers

- **Driver 1: Zero Semantic Duplication & Minimal Canonical Gate Set**: Eliminate pairs of inverted gates (e.g. `IF_CARD_IN_PLAY` vs `IF_CARD_NOT_IN_PLAY`, `IF_CONDITION_MET` vs `IF_CONDITION_NOT_MET`) in favor of an explicit `negate: boolean` flag, and consolidate result-dependent gates into canonical primitives.
- **Driver 2: Official Rules Reference v1.8 Authority**: Faithfully model RR v1.8 "Then" clauses (requiring successful execution of the preceding effect), result-dependent milestones (defeat, threat cleared to 0, full heal, status application), and state predicates (identity form, card in play, zone empty).
- **Driver 3: Producer-Agnostic Milestone Fact Tracking**: Replace binary `conditionMet` with typed `StepFacts` emitted by effect handlers, decoupled from consumer gate requirements.
- **Driver 4: Strict Schema & Compile-Time Enforcement**: Validate every gate against a centralized registry (`GATE_REGISTRY`), rejecting unknown gates, missing required params, or fact-consumer steps paired with incompatible effect producers.
- **Driver 5: Context Continuity Across Skipped Steps**: Ensure skipped steps correctly close downstream `THEN` chains while preserving entity targeting continuity (`PREVIOUS_TARGET`, `distinctFrom`) from the last successfully executed step.

---

## Decision Outcome

**Adopt a unified 9-gate taxonomy with typed `gateParams`, replace `conditionMet` with `StepFacts`, and enforce sequential context preservation:**

### 1. Canonical Step Gate Taxonomy (`StepGateSchema`)
Reduce all gating to 9 canonical values categorized by evaluation context:

| Category | Gate | Parameter Schema | Description |
| :--- | :--- | :--- | :--- |
| **RESULT** | `THEN` | `{ step?: string; negate?: boolean }` | Evaluates whether the referenced step (or previous step) completed successfully (not skipped and not failed). Replaces `IF_PREVIOUS_SUCCESS` and `IF_FAILED` (via `negate: true`). |
| **RESULT** | `IF_RESULT` | `{ fact: ResultFact; step?: string; negate?: boolean }` | Evaluates whether a specific fact occurred in the referenced step (or previous step). Supports facts: `defeated`, `excessDamage`, `amountZero`, `threatZero`, `fullyHealed`, `statusAdded`, `statusRemoved`, `villainDefeated`. |
| **STATE** | `IF_FORM` | `{ form?: 'HERO' \| 'ALTER_EGO'; target?: 'INITIATOR' \| 'TARGET'; negate?: boolean }` | Evaluates the hero/alter-ego identity form of the player or target. |
| **STATE** | `IF_PLAYER_HAS_TRAIT` | `{ trait: Trait; negate?: boolean }` | Evaluates whether the player possesses a specific trait. |
| **STATE** | `IF_ZONE_EMPTY` | `{ zone: Zone; negate?: boolean }` | Evaluates whether a designated zone is empty. Replaces `condition: ZONE_EMPTY`. |
| **STATE** | `IF_CARD_IN_PLAY` | `{ cardId: string; negate?: boolean }` | Evaluates whether a specific card is currently in play. Replaces `IF_CARD_NOT_IN_PLAY` (via `negate: true`). |
| **CONTEXT** | `IF_RESOURCE_MATCH` | `{ resource: ResourceType; count?: number; negate?: boolean }` | Evaluates resources spent to pay for the ability. |
| **CONTEXT** | `IF_UNDEFENDED_ATTACK` | `{ negate?: boolean }` | Evaluates whether the incoming attack was undefended. |
| **CONTEXT** | `IF_ACTIVATION_DEALT_DAMAGE` | `{ negate?: boolean }` | Evaluates whether the triggering enemy activation dealt damage. |

All legacy gates (`IF_PREVIOUS_SUCCESS`, `IF_AMOUNT_ZERO`, `IF_ZERO_HEALED`, `IF_FAILED`, `IF_ALREADY_HAS_STATUS`, `IF_CONDITION_MET`, `IF_CONDITION_NOT_MET`, `IF_CARD_NOT_IN_PLAY`, `ALWAYS`) and the `step.condition` property are completely removed.

### 2. Producer-Agnostic Milestone Facts (`StepFacts`)
Effect handlers now populate typed facts on `EffectResult` and `StepResolutionResult`:
```ts
export interface StepFacts {
  defeated?: boolean;
  excessDamage?: number;
  amountZero?: boolean;
  threatZero?: boolean;
  fullyHealed?: boolean;
  statusAdded?: boolean;
  statusRemoved?: boolean;
  villainDefeated?: boolean;
}
```
Effects populate facts naturally:
- `DEAL_DAMAGE`: sets `facts.defeated`, `facts.excessDamage`, `facts.villainDefeated`, and preserves `value` as the actual damage dealt to the target.
- `HEAL_DAMAGE`: sets `facts.fullyHealed`.
- `REMOVE_THREAT`: sets `facts.threatZero`.
- `ADD_STATUS` / `REMOVE_STATUS`: sets `facts.statusAdded` / `facts.statusRemoved`.
- `executeSequence`: sets `facts.amountZero = true` if `result.value === 0`.

### 3. Step References and D12 Explicit Step Targeting
Gates with a `step?: string` parameter can target an earlier step by its `id` (e.g. `step: "step_1_spawn_nemesis_minion"` on *Shadow of the Past*). If omitted, the gate targets the immediately preceding step in `ability.steps`.

### 4. D18 Context Continuity Across Skipped Steps
In `executeSequence`:
- Skipped steps are recorded in `stepResults` as `{ skipped: true }` and inserted into `stepResultsMap`.
- When evaluating the next step's gate, the immediate previous result `lastStepResult` reflects `{ skipped: true }`, ensuring a subsequent `THEN` gate is closed.
- However, entity targeting context (`lastExecutedResult`) is maintained across skipped steps so that subsequent steps using `PREVIOUS_TARGET`, `distinctFrom`, or `PREVIOUS_RESULT` resolve to the last executed step rather than undefined.

### 5. Dynamic Excess Damage Support
`DynamicValueSourceSchema.from` is expanded to include `'PREVIOUS_EXCESS_DAMAGE'`, allowing effects (such as Overkill damage distribution) to read `context.previousResult?.facts?.excessDamage ?? 0` directly.

### 6. Strict Zod Schema & superRefine Quality Gates
- Per-step `superRefine` validates that `gateParams` satisfies the exact schema registered in `GATE_REGISTRY`.
- Ability-level `superRefine` enforces:
  - Constant abilities cannot use RESULT or CONTEXT gates.
  - Step 0 cannot use RESULT gates.
  - The `step` reference must match an earlier step in the same ability.
  - Fact producer compatibility check: an `IF_RESULT` gate referencing a step requires that the referenced step's effect primitive can produce the requested fact per `FACT_PRODUCERS`.

---

## Consequences

### Positive Consequences
- **Cleaner supplemental cards**: Eliminates confusion between `gate` and `condition`, reducing boilerplate and human authoring errors.
- **Accurate damage modeling**: `value` always represents actual damage dealt; excess damage is tracked separately as a typed fact.
- **Robust testability**: Step gate evaluation and fact emission are decoupled, deterministic, and unit-tested in isolation.
- **Future-proof extensibility**: Adding a new gate requires only registering it in `GATE_REGISTRY` with its parameter schema and kind, which automatically flows into validation and editor tooling.

### Negative / Migration Consequences
- Existing cards in supplemental pack data using deprecated gate names or `condition` required migration to the new schema.
- Existing tests asserting `conditionMet` required updating to assert `facts` or `skipped`.

---

## References
- Issues: #289 (Step Gates / gateParams), #290 (Result Facts / Milestones)
- Supersedes: Section 3 of [ADR-0049](0049-composable-value-transformers-and-event-interception.md)
- Related: [ADR-0030](0030-unified-ability-step-sequence-architecture.md), [ADR-0078](0078-one-damage-pipeline-and-the-attack-label.md)
