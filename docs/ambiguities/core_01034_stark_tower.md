---
card_code: "01034"
card_name: "Stark Tower"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T10:10"
---

# Card Ambiguity Report: Stark Tower (`01034`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01034](https://marvelcdb.com/card/01034)
* **Official Printed Text:** `Alter-Ego Action: Exhaust Stark Tower → choose a player. That player returns the topmost [[Tech]] upgrade in their discard pile to their hand.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'RETRIEVE_CARD_FROM_DISCARD' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Implement missing TypeScript effect primitive or pipeline trigger dispatch in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
