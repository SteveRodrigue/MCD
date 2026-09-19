# 05. Card Authoring Decision Guide

> This is the one page in the atlas with no direct 1:1 spec equivalent — it's a practical
> decision tree for turning printed card text into a first-draft supplemental JSON entry.
> Always finish by checking your draft against the linked spec module before submitting.

---

## 1. "What `timing` do I use?"

```mermaid
flowchart TD
    Start(["Read the printed card text"]) --> Q1{"Does the text start with<br/>a bold keyword like<br/>Interrupt / Response / Forced?"}
    Q1 -->|"no keyword — it's a plain action"| Q2{"Form restriction<br/>printed (Hero/Alter-Ego icon)?"}
    Q2 -->|Hero only| HA["HERO_ACTION"]
    Q2 -->|Alter-Ego only| AA["ALTER_EGO_ACTION"]
    Q2 -->|none| ACT["ACTION"]
    Q1 -->|"Resource:"| Q3{"Form restriction?"}
    Q3 -->|Hero| HR["HERO_RESOURCE"]
    Q3 -->|Alter-Ego| AR["ALTER_EGO_RESOURCE"]
    Q3 -->|none| RES["RESOURCE"]
    Q1 -->|"Interrupt:"| Q4{"'Forced Interrupt'<br/>(mandatory) vs optional?"}
    Q4 -->|forced| FI["FORCED_INTERRUPT"]
    Q4 -->|optional| INT["INTERRUPT"]
    Q1 -->|"Response:"| Q5{"'Forced Response'<br/>(mandatory) vs optional?"}
    Q5 -->|forced| FR["FORCED_RESPONSE"]
    Q5 -->|optional| RSP["RESPONSE"]
    Q1 -->|"'When Revealed:' on an<br/>encounter card"| WR["WHEN_REVEALED"]
    Q1 -->|"passive aura, always active<br/>while face-up in play"| CONST["CONSTANT"]
```

Full enum reference: [02. Timings & Triggers §1](../specifications/supplemental/02_timings_and_triggers.md#1-ability-timing-types-timing).

---

## 2. "What `trigger` does my Interrupt/Response bind to?"

```mermaid
flowchart TD
    Start(["Card text names a moment,<br/>e.g. 'when the villain initiates an attack'"]) --> Q1{"What is happening<br/>at that moment?"}
    Q1 -->|"enemy about to attack"| T1["ENEMY_INITIATES_ATTACK"]
    Q1 -->|"you are about to take damage"| T2["DAMAGE_WOULD_BE_TAKEN"]
    Q1 -->|"you already took damage"| T3["DAMAGE_TAKEN"]
    Q1 -->|"a card entered play"| T4["CARD_PLAYED / ENTERS_PLAY"]
    Q1 -->|"a character was defeated"| T5["CHARACTER_DEFEATED / DEFEATED"]
    Q1 -->|"threat is about to be placed"| T6["THREAT_WOULD_BE_PLACED"]
    Q1 -->|"a scheme was fully thwarted"| T7["SCHEME_DEFEATED"]
    Q1 -->|"round/phase boundary"| T8["ROUND_BEGAN / ROUND_ENDED /<br/>PLAYER_PHASE_* / VILLAIN_PHASE_*"]
    T1 --> Check(["Cross-check exact wording against<br/>02_timings_and_triggers.md §2 table"])
    T2 --> Check
    T3 --> Check
    T4 --> Check
    T5 --> Check
    T6 --> Check
    T7 --> Check
    T8 --> Check
```

If your event isn't listed, check `TRIGGER_EQUIVALENTS` in
[`trigger-dispatcher.ts`](../../src/engine/triggers/trigger-dispatcher.ts) for an existing alias
before proposing a new trigger literal (new literals require an engine change, not just
supplemental data — see [feature-delivery skill](../../.agents/skills/feature-delivery/SKILL.md)).

---

## 3. "Do I need `steps: []`, `gate`, or `condition`?"

```mermaid
flowchart TD
    Start(["Ability has more than one effect,<br/>or an effect is conditional"]) --> Q1{"Does effect #2 only happen<br/>if effect #1 changed something?<br/>('Then, ...')"}
    Q1 -->|yes| ThenGate["Step 2: gate: THEN"]
    Q1 -->|no| Q2{"Does effect #2 depend on how<br/>the cost was paid?<br/>(e.g. discarded a [mental] card)"}
    Q2 -->|yes| ResGate["Step 2: gate: IF_RESOURCE_MATCH<br/>+ gateParams"]
    Q2 -->|no| Q3{"Does effect #2 depend on a<br/>named milestone from step #1?<br/>(scheme cleared, target defeated...)"}
    Q3 -->|yes| CondGate["Step 1: condition: SCHEME_EMPTY (etc.)<br/>Step 2: gate: IF_CONDITION_MET"]
    Q3 -->|no| Q4{"Does the player pick between<br/>2+ discrete outcomes?"}
    Q4 -->|yes| Choice["Single step: effect: PLAYER_CHOICE<br/>with options: []"]
    Q4 -->|no| Plain["Just list effects as separate<br/>steps with gate: ALWAYS (default)"]
```

Full gate/condition catalog:
[10. Sequences & Modals §1](../specifications/supplemental/10_sequences_and_prompts.md#1-unified-action-step-sequencing-steps--conditional-gates).

---

## 4. Draft-to-Submission Checklist

1. Pick `timing` → §1 above.
2. Pick `trigger` (if reactive) → §2 above.
3. Pick effect primitive(s) from
   [05](../specifications/supplemental/05_effects_combat_threat.md)–[08](../specifications/supplemental/08_effects_villain_nemesis.md)
   by category (combat, zones, status/economy, villain/nemesis).
4. Sequence multi-effect abilities with `steps: []`, `gate`/`condition` → §3 above.
5. Add `cost` ([03. Costs & Targeting](../specifications/supplemental/03_costs_and_targeting.md))
   and `playRequirements` ([11. Play Requirements](../specifications/supplemental/11_play_requirements.md))
   if the card restricts who/when it can be used.
6. Validate against [`tests/data/supplemental-schema.test.ts`](../../tests/data/supplemental-schema.test.ts)
   and follow the [Card Integration Protocol](../../.agents/skills/card-integration-protocol/SKILL.md)
   for ambiguity handling.

---

**Previous:** [04. Combat & Villain Phase Sequences](./04-combat-and-villain-phase.md)
**Back to index:** [Visual Guides README](./README.md)
