---
card_code: "01004"
card_name: "Enhanced Spider-Sense"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Enhanced Spider-Sense (`01004`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01004](https://marvelcdb.com/card/01004)
* **Official Printed Text:** `Hero Interrupt: When a treachery card is revealed from the encounter deck, cancel its "When Revealed" effects.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Treachery Cancel Interceptor loop (CANCEL_WHEN_REVEALED) not implemented in villain-phase.ts step5.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
