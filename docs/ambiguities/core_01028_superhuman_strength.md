---
card_code: "01028"
card_name: "Superhuman Strength"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T10:10"
---

# Card Ambiguity Report: Superhuman Strength (`01028`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01028](https://marvelcdb.com/card/01028)
* **Official Printed Text:** `She-Hulk gets +2 ATK.
Forced Response: After She-Hulk attacks, discard Superhuman Strength → stun the attacked enemy.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'ATK_BONUS' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Implement missing TypeScript effect primitive or pipeline trigger dispatch in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
