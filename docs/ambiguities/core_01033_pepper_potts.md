---
card_code: "01033"
card_name: "Pepper Potts"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Pepper Potts (`01033`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01033](https://marvelcdb.com/card/01033)
* **GitHub Issue:** [#13 - Read from the top card on the discard pile.](https://github.com/SteveRodrigue/MCD/issues/13)
* **Official Printed Text:** `Resource: Exhaust Pepper Potts → generate the resources of the top card in your discard pile.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'GENERATE_TOP_DISCARD_RESOURCES' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
