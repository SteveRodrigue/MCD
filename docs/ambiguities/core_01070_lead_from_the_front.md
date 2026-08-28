---
card_code: "01070"
card_name: "Lead from the Front"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T10:10"
---

# Card Ambiguity Report: Lead from the Front (`01070`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01070](https://marvelcdb.com/card/01070)
* **Official Printed Text:** `Hero Action: Choose a player. Each character that player controls gets +1 THW and +1 ATK until the end of the phase.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'BUFF_ALL_FRIENDLY_CHARACTERS' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Implement missing TypeScript effect primitive or pipeline trigger dispatch in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
