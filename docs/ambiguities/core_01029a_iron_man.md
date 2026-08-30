---
card_code: "01029a"
card_name: "Iron Man"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Iron Man (`01029a`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01029a](https://marvelcdb.com/card/01029a)
* **GitHub Issue:** [#9 - Generic card filter/counter](https://github.com/SteveRodrigue/MCD/issues/9)
* **Official Printed Text:** `You get +1 hand size for each [[Tech]] upgrade you control (to a maximum hand size of 7).`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Iron Man hand size scaling from Tech upgrades (HAND_SIZE_BONUS_PER_TECH_UPGRADE) not dynamically computed in round upkeep.**
2. **Effect primitive 'DYNAMIC_HAND_SIZE' is not implemented in src/engine/effects/index.ts.**
3. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
