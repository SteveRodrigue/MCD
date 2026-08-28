---
card_code: "01110"
card_name: "Hydra Bomber"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Hydra Bomber (`01110`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01110](https://marvelcdb.com/card/01110)
* **Official Printed Text:** `When Revealed: Choose to either take 2 damage or place 1 threat on the main scheme.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Interactive Decision Modal State Machine (Tier 3 Gate / ADR-0020): Hydra Bomber requires generic PLAYER_CHOICE interactive prompt modal in UI.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
