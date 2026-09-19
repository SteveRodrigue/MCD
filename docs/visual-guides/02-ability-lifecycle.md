# 02. Ability Lifecycle

> Companion to [03. Costs & Targeting](../specifications/supplemental/03_costs_and_targeting.md)
> and [10. Sequences & Modals](../specifications/supplemental/10_sequences_and_prompts.md).
> This is the diagram to open whenever you're wondering _"in what order does my ability's
> JSON actually get evaluated?"_

---

## 1. From Card JSON to Applied Effect

```mermaid
flowchart TD
    A["Card ability declared in<br/>src/data/supplemental/pack/*.json"] --> B{"timing matches an<br/>available window?<br/>(ACTION, RESOURCE, INTERRUPT, ...)"}
    B -->|no| Blocked(["Not offered / does not fire"])
    B -->|yes| C{"Legality check<br/>(legality-checker.ts)"}
    C -->|"e.g. no valid target,<br/>form mismatch, playRequirements fail"| Blocked
    C -->|legal| D{"cost payable?<br/>(cost-engine.ts canPayAbilityCost)"}
    D -->|"resources / exhaust / discard /<br/>heal / damage cost unaffordable"| Blocked
    D -->|payable| E["Pay cost<br/>(executeAbilityCost)"]
    E --> F["Execute steps[] in order<br/>(AbilityStep pipeline)"]
    F --> G["Dispatch resulting triggers<br/>(see 03-trigger-resolution-stack.md)"]
    G --> H(["State mutated, log entries emitted"])
```

---

## 2. Executing One `steps[]` Array

Each entry in `steps: []` is evaluated independently, in array order, and may reference the
outcome of a previous step via `condition` / `gate` / `target: "PREVIOUS_TARGET"`.

```mermaid
flowchart TD
    Step(["Step N: { effect, gate?, gateParams?, effectParams?, condition? }"]) --> GateCheck{"gate present?"}
    GateCheck -->|"no (defaults to ALWAYS)"| Run["Run effect primitive<br/>(src/engine/effects/index.ts)"]
    GateCheck -->|"yes, e.g. THEN, IF_RESOURCE_MATCH,<br/>IF_CONDITION_MET, IF_CARD_IN_PLAY"| Eval{"Evaluate gate against<br/>gateParams + prior step outcome"}
    Eval -->|false| Skip(["Step skipped, no state change"])
    Eval -->|true| Run
    Run --> Condition{"condition declared?<br/>(e.g. SCHEME_EMPTY, TARGET_DEFEATED)"}
    Condition -->|yes| Record["Record milestone outcome<br/>for a later step's gate to read"]
    Condition -->|no| Next
    Record --> Next(["Advance to Step N+1"])
    Skip --> Next
```

> [!NOTE]
> `gateParams` configures the _gate_ (whether the step runs); `effectParams` configures the
> _effect_ (what the step does) — they are never merged. See
> [ADR-0060](../decisions/0060-gate-and-effect-params-separation.md), or
> [10. Sequences & Modals §1](../specifications/supplemental/10_sequences_and_prompts.md#1-unified-action-step-sequencing-steps--conditional-gates).

---

## 3. Interactive Steps: `PLAYER_CHOICE`

When a step's `effect` is `PLAYER_CHOICE`, the pipeline above pauses instead of running
straight through:

```mermaid
sequenceDiagram
    participant Steps as Ability Step Pipeline
    participant Queue as prompt-queue.ts
    participant UI as DecisionPromptModal.tsx
    participant Player

    Steps->>Queue: enqueueDecisionPrompt(options[])
    Queue->>UI: pendingDecisionQueue head rendered
    UI->>Player: Show Pop-Art choice modal
    Player->>UI: Select one option
    UI->>Queue: resolveDecisionPrompt(selectedOption)
    Queue->>Steps: Execute selectedOption.effect / params
    Steps->>Steps: Resume remaining steps[] (if any)
```

---

**Previous:** [01. Engine & Round Overview](./01-engine-overview.md)
**Next:** [03. Trigger Resolution Stack](./03-trigger-resolution-stack.md) — how the engine
orders reactions when several cards want to respond to the same event.
