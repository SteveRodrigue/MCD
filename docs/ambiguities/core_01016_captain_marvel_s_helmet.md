---
card_code: "01016"
card_name: "Captain Marvel's Helmet"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Captain Marvel's Helmet (`01016`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01016](https://marvelcdb.com/card/01016)
* **Official Printed Text:** `Captain Marvel gets +1 DEF (+2 DEF instead if you have the [[Aerial]] trait).`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'DEF_BONUS' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
