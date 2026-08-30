---
card_code: "01023"
card_name: "Legal Practice"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Legal Practice (`01023`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01023](https://marvelcdb.com/card/01023)
* **GitHub Issue:** [#6 - Cost of action (discard)](https://github.com/SteveRodrigue/MCD/issues/6)
* **Official Printed Text:** `Alter-Ego Action (thwart): Choose and discard up to 5 cards from your hand → remove 1 threat from a scheme for each card discarded this way.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'DISCARD_CARDS_REMOVE_THREAT' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
