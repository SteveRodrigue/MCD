---
card_code: "01029b"
card_name: "Tony Stark"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Tony Stark (`01029b`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01029b](https://marvelcdb.com/card/01029b)
* **GitHub Issue:** [#10 - Card draw/search/look function -> 2 piles output with destinations.](https://github.com/SteveRodrigue/MCD/issues/10)
* **Official Printed Text:** `Futurist — Action: Look at the top 3 cards of your deck. Add 1 to your hand and discard the others. (Limit once per round.)`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Iron Man hand size scaling from Tech upgrades (HAND_SIZE_BONUS_PER_TECH_UPGRADE) not dynamically computed in round upkeep.**
2. **Effect primitive 'SCRY_AND_SELECT_TRAIT' is not implemented in src/engine/effects/index.ts.**
3. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
