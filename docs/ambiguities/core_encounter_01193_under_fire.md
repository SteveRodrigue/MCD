---
card_code: "01193"
card_name: "Under Fire"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Under Fire (`01193`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01193](https://marvelcdb.com/card/01193)
* **Official Printed Text:** `Surge.
When Revealed: Reveal the top card of the encounter deck.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'REVEAL_ENCOUNTER_CARD_WITH_SURGE' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
