---
card_code: "01046"
card_name: "Energy Daggers"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T10:10"
---

# Card Ambiguity Report: Energy Daggers (`01046`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01046](https://marvelcdb.com/card/01046)
* **Official Printed Text:** `Special: Choose a player. Deal 1 damage to the villain and to each enemy engaged with that player (2 damage instead if this is the final step of this sequence).
(Play the "Wakanda Forever!" event to use this ability.)`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'DEAL_DAMAGE_ALL_ENEMIES' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Implement missing TypeScript effect primitive or pipeline trigger dispatch in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
