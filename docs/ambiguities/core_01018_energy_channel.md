---
card_code: "01018"
card_name: "Energy Channel"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Energy Channel (`01018`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01018](https://marvelcdb.com/card/01018)
* **Official Printed Text:** `Max 1 per player.
Action: Spend X [energy] resources → put X energy counters here.
Hero Action (attack): Discard Energy Channel → deal 2 damage to an enemy (to a maximum of 10) for each energy counter here.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Captain Marvel Energy Channel energy counter accumulation and discharge pipeline not implemented.**
2. **Effect primitive 'ADD_COUNTER' is not implemented in src/engine/effects/index.ts.**
3. **Effect primitive 'DEAL_DAMAGE_PER_COUNTER' is not implemented in src/engine/effects/index.ts.**
4. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
