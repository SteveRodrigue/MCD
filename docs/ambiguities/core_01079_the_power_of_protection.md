---
card_code: "01079"
card_name: "The Power of Protection"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: The Power of Protection (`01079`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01079](https://marvelcdb.com/card/01079)
* **Official Printed Text:** `Max 2 per deck.
Double the number of resources this card generates while paying for a Protection (green) card.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'DOUBLE_RESOURCE_FOR_ASPECT' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
