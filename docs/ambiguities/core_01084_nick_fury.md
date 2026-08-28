---
card_code: "01084"
card_name: "Nick Fury"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T10:10"
---

# Card Ambiguity Report: Nick Fury (`01084`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01084](https://marvelcdb.com/card/01084)
* **Official Printed Text:** `Forced Response: After Nick Fury enters play, choose one: remove 2 threat from a scheme, draw 3 cards, or deal 4 damage to an enemy. At the end of the round, if Nick Fury is still in play, discard him.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'DISCARD_SELF' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Implement missing TypeScript effect primitive or pipeline trigger dispatch in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
