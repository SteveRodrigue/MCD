---
card_code: "01077"
card_name: "Counter-Punch"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Counter-Punch (`01077`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01077](https://marvelcdb.com/card/01077)
* **Official Printed Text:** `Response (attack): After your hero defends against an enemy attack, deal damage to that enemy equal to your hero's ATK.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'DEAL_DAMAGE_EQUAL_TO_HERO_ATK' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
