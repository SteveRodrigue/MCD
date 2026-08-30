# 09. Action Sequencing & Interactive Prompts

---

## 1. Multi-Action Sequencing (`sequence: []`)

* **Status:** 🟡 `ROADMAP` (Issue [#7](https://github.com/SteveRodrigue/MCD/issues/7) - *Split Personality* `01025` / Issue [#26](https://github.com/SteveRodrigue/MCD/issues/26) - *Get Behind Me!* `01078`)
* **Description:** Decomposes complex cards into ordered sequences of discrete, reusable sub-actions.

```json
{
  "id": "split_personality_sequence",
  "timing": "ACTION",
  "sequence": [
    {
      "id": "step_1_flip",
      "timing": "ACTION",
      "effect": "FLIP_FORM",
      "params": {}
    },
    {
      "id": "step_2_draw",
      "timing": "ACTION",
      "effect": "DRAW_UP_TO_HAND_SIZE",
      "params": {}
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
