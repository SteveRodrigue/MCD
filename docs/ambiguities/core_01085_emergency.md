---
card_code: "01085"
card_name: "Emergency"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T10:10"
---

# Card Ambiguity Report: Emergency (`01085`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01085](https://marvelcdb.com/card/01085)
* **Official Printed Text:** `Interrupt (thwart): When the villain schemes, reduce the amount of threat placed on the scheme by 1.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Optional interrupt prompt state machine not implemented in GameState.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Implement missing TypeScript effect primitive or pipeline trigger dispatch in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
