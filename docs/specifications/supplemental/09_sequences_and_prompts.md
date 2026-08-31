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

### Example:
```json
{
  "id": "split_personality",
  "timing": "ACTION",
  "steps": [
    {
      "id": "step_1_flip",
      "effect": "FLIP_FORM"
    },
    {
      "id": "step_2_draw",
      "effect": "DRAW_UP_TO_HAND_SIZE",
      "gate": "THEN"
    }
  ]
}
```

---

## 2. Interactive Decision Prompts (`PLAYER_CHOICE`)

* **Status:** 🟢 `IMPLEMENTED (v1.0)` ([`DecisionPromptModal.tsx`](file:///c:/Users/steve/OneDrive/Documents/Coding/MCD/src/ui/components/board/DecisionPromptModal.tsx) / *Nick Fury* `01084` / *Hydra Bomber* `01110` / *Exhaustion* `01191`)
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
