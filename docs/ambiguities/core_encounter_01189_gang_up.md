---
card_code: "01189"
card_name: "Gang-Up"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Gang-Up (`01189`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01189](https://marvelcdb.com/card/01189)
* **Official Printed Text:** `When Revealed (Alter-Ego): This card gains surge.
When Revealed (Hero): The villain and each minion engaged with you attacks you.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'VILLAIN_AND_ENGAGED_MINIONS_ATTACK' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
