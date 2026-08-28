---
card_code: "01071"
card_name: "Make the Call"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Make the Call (`01071`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01071](https://marvelcdb.com/card/01071)
* **Official Printed Text:** `Action: Pay the printed cost of an ally in any player's discard pile → put that ally into play under your control.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'PLAY_ALLY_FROM_DISCARD' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
