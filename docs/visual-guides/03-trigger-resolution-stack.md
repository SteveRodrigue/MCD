# 03. Trigger Resolution Stack

> Companion to [02. Timings & Triggers](../specifications/supplemental/02_timings_and_triggers.md)
> and [`algorithmic_rules_reference.md §4`](../algorithmic_rules_reference.md#4-the-7-stage-timing-pipeline--nested-resolution-stack).
> Read this whenever two or more cards could react to the same in-game event.

---

## 1. The 7-Stage Nested Resolution Stack

Every dispatched event (an attack, damage, a card entering play, threat placement, etc.)
passes through this fixed pipeline, implemented conceptually in
[`src/engine/triggers/trigger-dispatcher.ts`](../../src/engine/triggers/trigger-dispatcher.ts):

```mermaid
flowchart TD
    Event(["Event occurs<br/>(e.g. dispatchTrigger(state, 'ATTACK', ctx))"]) --> S1["1. Forced Interrupts<br/>(timing: FORCED_INTERRUPT)"]
    S1 -->|cancelled?| Cancel1(["Event cancelled, stop"])
    S1 --> S2["2. Voluntary Interrupts<br/>(timing: INTERRUPT / HERO_INTERRUPT / ALTER_EGO_INTERRUPT)"]
    S2 -->|cancelled?| Cancel2(["Event cancelled, stop"])
    S2 --> S3["3. Event Resolution<br/>(the primary action/effect executes)"]
    S3 --> S4["4. Replacement Effects<br/>(e.g. Tough status absorbs the hit)"]
    S4 --> S5["5. Post-Resolution State Checks<br/>(defeat checks, threshold checks)"]
    S5 --> S6["6. Forced Responses<br/>(timing: FORCED_RESPONSE)"]
    S6 --> S7["7. Voluntary Responses<br/>(timing: RESPONSE / HERO_RESPONSE / ALTER_EGO_RESPONSE)"]
    S7 --> Done(["Pipeline complete"])
```

> [!IMPORTANT]
> **Simultaneous ordering:** if multiple abilities are eligible at the _same_ stage, the
> active/first player chooses resolution order (RR v1.8 p. 16). The engine does not guess —
> it prompts.

---

## 2. Matching a Card's `trigger` to a Dispatch Point

A card's `trigger` field (e.g. `'ATTACK'`, `'DAMAGE_WOULD_BE_TAKEN'`, `'CARD_PLAYED'`) selects
_which_ event this ability listens for; its `timing` (`INTERRUPT` vs `RESPONSE` vs
`FORCED_*`) selects _which stage above_ it resolves at.

```mermaid
flowchart LR
    Card["Card ability<br/>{ timing, trigger, filter? }"] --> Match{"trigger === dispatched event?<br/>(with TRIGGER_EQUIVALENTS aliasing,<br/>e.g. ENEMY_INITIATES_ATTACK ⇄ VILLAIN_INITIATES_ATTACK)"}
    Match -->|no| Ignore(["Ability does not fire"])
    Match -->|yes| Filter{"TriggerFilter matches?<br/>(attackerKind, sourceCardCode,<br/>targetForm, targetType, isEngaged...)"}
    Filter -->|no| Ignore
    Filter -->|yes| Stage["Slot into pipeline stage<br/>per timing (see diagram above)"]
```

- Full `trigger` catalog and source pipeline mapping:
  [02. Timings & Triggers §2](../specifications/supplemental/02_timings_and_triggers.md#2-event-trigger-windows-trigger).
- Alias table (`TRIGGER_EQUIVALENTS`) lives in
  [`trigger-dispatcher.ts`](../../src/engine/triggers/trigger-dispatcher.ts) — e.g. a card
  written against `CHARACTER_DEFEATED` also fires for `MINION_DEFEATED` and `HOST_DEFEATED`.

---

## 3. Worked Example: Spider-Sense vs. an Incoming Attack

```mermaid
sequenceDiagram
    participant VP as Villain Phase
    participant TD as trigger-dispatcher.ts
    participant SS as Spider-Sense (INTERRUPT @ ENEMY_INITIATES_ATTACK)
    participant CP as combat-pipeline.ts

    VP->>CP: initiateEnemyAttack(target)
    CP->>TD: dispatchTrigger('ENEMY_INITIATES_ATTACK', ctx)
    TD->>SS: Stage 2 (Voluntary Interrupt) — eligible?
    SS-->>TD: Player accepts — draw 1 card
    TD-->>CP: Interrupts resolved, continue
    CP->>CP: Step 3-7 (defender declared, boosts, damage)
```

---

**Previous:** [02. Ability Lifecycle](./02-ability-lifecycle.md)
**Next:** [04. Combat & Villain Phase Sequences](./04-combat-and-villain-phase.md) — the
concrete step-by-step order of an attack and of the Villain Phase.
