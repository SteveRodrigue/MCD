---
card_code: "01041"
card_name: "Shuri"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Shuri (`01041`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01041](https://marvelcdb.com/card/01041)
* **Official Printed Text:** `Response: After Shuri enters play, search your deck for an upgrade and add it to your hand. Shuffle your deck.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'SEARCH_DECK_FOR_CARD' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
