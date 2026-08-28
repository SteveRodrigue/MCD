---
card_code: "01095"
card_name: "Rhino (Stage II)"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Rhino (Stage II) (`01095`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01095](https://marvelcdb.com/card/01095)
* **Official Printed Text:** `When Revealed: Search the encounter deck and discard pile for the Breakin' & Takin' side scheme and reveal it. Shuffle the encounter deck.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Multi-Stage Villain Transition State Machine (Tier 3): Advancing from Stage I -> II -> III upon 0 HP is not implemented in action-dispatcher.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
