---
card_code: "01029b"
card_name: "Tony Stark"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T10:10"
---

# Card Ambiguity Report: Tony Stark (`01029b`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01029b](https://marvelcdb.com/card/01029b)
* **Official Printed Text:** `Futurist — Action: Look at the top 3 cards of your deck. Add 1 to your hand and discard the others. (Limit once per round.)`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'SCRY_AND_SELECT_TRAIT' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Implement missing TypeScript effect primitive or pipeline trigger dispatch in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
