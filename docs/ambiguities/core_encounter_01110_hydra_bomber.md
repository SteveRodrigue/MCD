---
card_code: "01110"
card_name: "Hydra Bomber"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "INTERACTIVE_DECISION_PROMPT_STATE_MACHINE"
date_logged: "2026-08-28T12:43"
---

# Card Ambiguity Report: Hydra Bomber (`01110`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01110](https://marvelcdb.com/card/01110)
* **Official Printed Text:** `<b>When Revealed</b>: Choose to either take 2 damage or place 1 threat on the main scheme.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Strict Prohibition on Card-Specific Effect Names (ADR-0021):** The previous ad-hoc primitive `HYDRA_BOMBER_CHOICE` was an anti-pattern that hardcoded card-specific logic into `src/engine/effects/index.ts`.
2. **Generic Composable Primitive Required (`PLAYER_CHOICE`):** Multi-choice cards must be modeled using composable nested sub-effects (`PLAYER_CHOICE` with `options: [DEAL_DAMAGE, ADD_THREAT]`).
3. **Missing Interactive Decision Modal State Machine (Tier 3 Gate):** Executing interactive choices during encounter card reveals requires `state.pendingDecisionPrompt` on `GameState` and an interactive UI modal (Phase 2.5 Roadmap / ADR-0020).
4. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Implement the generic `PLAYER_CHOICE` effect primitive in `src/engine/effects/index.ts`.
* Implement `pendingDecisionPrompt` state machine and `RESOLVE_DECISION_PROMPT` action handler in `src/engine/pipeline/action-dispatcher.ts`.
* Build interactive Pop-Art `DecisionPromptModal.tsx` in UI.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
