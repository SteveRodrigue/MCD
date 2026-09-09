# 09. Action Sequencing & Interactive Prompts

---

## 1. Unified Action Step Sequencing (`steps: []`) & Conditional Gates

* **Status:** 🟢 `IMPLEMENTED (v1.0)` (ADR-0028, ADR-0030 / *Split Personality* `01025`, *Hard to Keep Down* `01104`, *I'm Tough* `01105`, *Under Fire* `01193`)
* **Description:** Decomposes all card abilities into an ordered execution pipeline of discrete, reusable atomic `AbilityStep` primitives, with optional conditional gating (`gate: ...`) and contextual data-flow passing (`target: "PREVIOUS_TARGET"`).

### Conditional Gates:
* `"ALWAYS"` *(Default)*: Executes unconditionally per RR v1.8 p. 2 "Do as much as you can".
* `"THEN"` / `"IF_PREVIOUS_SUCCESS"`: Executes Step $N$ only if Step $N-1$ mutated the game state (RR v1.8 p. 24 "Then").
* `"IF_AMOUNT_ZERO"` / `"IF_ZERO_HEALED"`: Executes Step $N$ (e.g. `TRIGGER_SURGE`) if Step $N-1$ caused 0 state mutation (e.g. at full health).
* `"IF_ALREADY_HAS_STATUS"`: Executes Step $N$ if the target already has the status card before applying.
* `"IF_FAILED"`: Executes Step $N$ if Step $N-1$ could not resolve.
* `"IF_RESOURCE_MATCH"`: Evaluates whether a required resource type was spent during action payment.
* `"IF_CONDITION_MET"` ([ADR-0049](../../decisions/0049-composable-value-transformers-and-event-interception.md)): Executes Step $N$ only if the explicitly monitored condition (`condition` in Step $N-1$ or targeted by `targetStepId`) evaluated to `true`.

### Explicit Condition Contracts (`StepConditionSchema`)

Under **ADR-0049**, rather than relying on implicit side-effects, an ability step explicitly specifies what condition milestone it evaluates via `condition`:

| Category | Condition Contract | Evaluated Milestone | Context / Primitive |
| :--- | :--- | :--- | :--- |
| **Core Milestone** | `SCHEME_EMPTY` | Targeted scheme has `remainingThreat === 0` after threat removal. | `REMOVE_THREAT` (*Clear the Area* `04049`) |
| **Core Milestone** | `TARGET_DEFEATED` | Targeted enemy/character reached 0 HP from damage. | `DEAL_DAMAGE` (*Relentless Assault* `01053`) |
| **Core Milestone** | `FULLY_HEALED` | Targeted character's damage reduced to 0 (`health === maxHealth`). | `HEAL_DAMAGE` (*First Aid* `01086`) |
| **Core Milestone** | `STATUS_APPLIED` | Status was placed (target did not already possess it & wasn't immune). | `ADD_STATUS` (*Mockingbird* `01083`) |
| **Core Milestone** | `EXCESS_DAMAGE_DEALT` | Damage dealt exceeded remaining HP (Overkill damage). | `DEAL_DAMAGE` (*Hand Cannon*) |
| **Entity State** | `ALREADY_HAS_STATUS` | Target character already possessed status card prior to application. | `ADD_STATUS` (*I'm Tough* `01105`) |
| **Entity State** | `TARGET_ALREADY_EXHAUSTED` | Target was already exhausted. | `EXHAUST` |
| **Entity State** | `TARGET_TRAIT_MATCH` | Targeted entity possesses specified trait (e.g. `[[AERIAL]]`). | Card filter |
| **Entity State** | `TARGET_FORM_MATCH` | Identity is in specified form (`hero`, `alter_ego`, etc.). | Form check |
| **Resource** | `RESOURCE_KICKER_MET` | Resources spent to pay for card match required kicker icon(s). | *Photonic Blast* (`01013`), *Relentless Assault* (`01053`) |
| **Threshold** | `COUNTER_THRESHOLD_MET` | Target upgrade/support has reached or exceeded counter count. | *Energy Channel* (`01018`) |
| **Threshold** | `ZONE_EMPTY` | Evaluated zone (e.g. hand, discard) contains 0 cards. | Zone check |

### Example: Clear the Area Pattern (*Clear the Area* `04049` / *Photonic Blast* `01013`)

```json
{
  "steps": [
    {
      "id": "remove_threat_step",
      "effect": "REMOVE_THREAT",
      "condition": "SCHEME_EMPTY",
      "params": {
        "target": "CHOSEN_SCHEME",
        "amount": 2
      }
    },
    {
      "id": "draw_if_cleared",
      "effect": "DRAW_CARDS",
      "gate": "IF_CONDITION_MET",
      "params": {
        "targetStepId": "remove_threat_step",
        "count": 1
      }
    }
  ]
}
```


---

## 2. Interactive Decision Prompts (`PLAYER_CHOICE`)

* **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`DecisionPromptModal.tsx`](../../../src/ui/components/board/DecisionPromptModal.tsx) / *Nick Fury* `01084` / *Hydra Bomber* `01110` / *Exhaustion* `01191`)
* **Description:** Renders a Pop-Art comic decision modal, blocking state execution until the player resolves their choice.

```json
{
  "effect": "PLAYER_CHOICE",
  "params": {
    "promptTitle": "Nick Fury's Orders",
    "promptMessage": "Choose 1 of the following options:",
    "options": [
      {
        "id": "opt_remove_threat",
        "label": "Remove 2 threat from a scheme",
        "effect": "REMOVE_THREAT",
        "params": { "amount": 2, "target": "MAIN_SCHEME" }
      },
      {
        "id": "opt_draw_cards",
        "label": "Draw 3 cards",
        "effect": "DRAW_CARDS",
        "params": { "count": 3, "target": "SELF_IDENTITY" }
      },
      {
        "id": "opt_deal_damage",
        "label": "Deal 4 damage to an enemy",
        "effect": "DEAL_DAMAGE",
        "params": { "amount": 4, "target": "CHOSEN_ENEMY" }
      }
    ]
  }
}
```
