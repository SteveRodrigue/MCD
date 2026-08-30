---
card_code: "01040a"
card_name: "Black Panther"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Black Panther (`01040a`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01040a](https://marvelcdb.com/card/01040a)
* **GitHub Issue:** [#15 - Skill is mixing hero and alter-ego form.](https://github.com/SteveRodrigue/MCD/issues/15)
* **Official Printed Text:** `Retaliate 1. (After this character is attacked, deal 1 damage to the attacking character.)`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'SEARCH_AND_PLAY_UPGRADE' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
