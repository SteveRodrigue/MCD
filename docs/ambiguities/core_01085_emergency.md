---
card_code: "01085"
card_name: "Emergency"
pack: "core"
confidence_reached: 80
blocker_category: "INTERRUPT_PROMPT_VILLAIN_PHASE"
date_logged: "2026-08-28T09:27"
---

# Card Ambiguity Report: Emergency (`#01085`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01085](https://marvelcdb.com/card/01085)
* **Official Printed Text:** `<b>Interrupt</b> <i>(thwart)</i>: When the villain schemes, reduce the amount of threat placed on the scheme by 1.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
* **Trigger Window:** `INTERRUPT` when threat would be placed on a scheme.
* **Blocker Reason:** Requires `pendingInterruptPrompt` in `GameState` and interactive UI prompt during Villain Phase Step 2 (ADR-0020).
* **Current Confidence:** 80% (Tier 3 Gate Fired).
