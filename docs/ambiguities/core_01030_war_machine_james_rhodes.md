---
card_code: "01030"
card_name: "War Machine (James Rhodes)"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: War Machine (James Rhodes) (`01030`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01030](https://marvelcdb.com/card/01030)
* **GitHub Issue:** [#11 - Cost Arrow War Machine](https://github.com/SteveRodrigue/MCD/issues/11)
* **Official Printed Text:** `Action: Exhaust War Machine and deal 2 damage to him → deal 1 damage to each enemy.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'DEAL_DAMAGE_ALL_ENEMIES' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
