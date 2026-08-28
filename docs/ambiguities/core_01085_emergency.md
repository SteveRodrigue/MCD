---
card_code: "01085"
card_name: "Emergency"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Emergency (`01085`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01085](https://marvelcdb.com/card/01085)
* **Official Printed Text:** `Interrupt (thwart): When the villain schemes, reduce the amount of threat placed on the scheme by 1.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Optional interrupt prompt modal state machine (pendingDecisionPrompt / ADR-0020) not implemented.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
