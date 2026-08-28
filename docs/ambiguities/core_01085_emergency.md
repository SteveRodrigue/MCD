---
card_code: "01085"
card_name: "Emergency"
pack: "core"
confidence_reached: 75
blocker_category: "TIER_3_STRUCTURAL_REFACTOR"
date_logged: "2026-08-28T08:44"
---

# Card Ambiguity Report: Emergency (`#01085`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01085](https://marvelcdb.com/card/01085)
* **Official Printed Text:** `<b>Interrupt</b> <i>(thwart)</i>: When the villain schemes, reduce the amount of threat placed on the scheme by 1.`

---

## 🔍 Why Tier 3 Structural Gate Was Triggered
* **Architectural Blocker:** Requires interactive optional interrupt decision modal (pendingInterruptPrompt) during Villain Scheme Step 2.
* **Confidence Level:** 75% (Requires structural engine state machine or pipeline hooks).
* **Action Taken:** Card isolated in ambiguity queue; active engine code remains stable without ad-hoc hacks.

---

## 🛠️ Step-by-Step Resolution Requirements
1. Implement the required structural pipeline / UI state machine.
2. Verify with automated unit tests.
3. Delete this file from `docs/ambiguities/` upon resolution (Inbox Zero).
