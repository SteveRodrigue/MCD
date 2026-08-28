---
card_code: "01010a"
card_name: "Captain Marvel"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T10:10"
---

# Card Ambiguity Report: Captain Marvel (`01010a`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01010a](https://marvelcdb.com/card/01010a)
* **Official Printed Text:** `Rechannel — Action: Spend a [energy] resource and heal 1 damage from Captain Marvel → draw 1 card. (Limit once per round.)`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'HEAL_AND_DRAW' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Implement missing TypeScript effect primitive or pipeline trigger dispatch in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
