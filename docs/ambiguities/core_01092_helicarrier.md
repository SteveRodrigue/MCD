---
card_code: "01092"
card_name: "Helicarrier"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Helicarrier (`01092`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01092](https://marvelcdb.com/card/01092)
* **Official Printed Text:** `Max 1 per player.
Action: Exhaust Helicarrier → choose a player. Reduce the resource cost of the next card that player plays this phase by 1.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'REDUCE_NEXT_CARD_COST' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
