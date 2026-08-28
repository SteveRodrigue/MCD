---
card_code: "01111"
card_name: "Explosion"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Explosion (`01111`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01111](https://marvelcdb.com/card/01111)
* **Official Printed Text:** `When Revealed: If Bomb Scare is in play, assign X damage among heroes and allies, where X is the amount of threat on Bomb Scare. If Bomb Scare is not in play, this card gains surge.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'HERO_FORM_BRANCH' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
