---
card_code: "01042"
card_name: "Ancestral Knowledge"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Ancestral Knowledge (`01042`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01042](https://marvelcdb.com/card/01042)
* **Official Printed Text:** `Alter-Ego Action: Choose up to 3 different cards in your discard pile and shuffle them into your deck.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'SHUFFLE_DISCARD_INTO_DECK' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
