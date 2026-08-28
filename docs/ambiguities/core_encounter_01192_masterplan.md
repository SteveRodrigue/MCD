---
card_code: "01192"
card_name: "Masterplan"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Masterplan (`01192`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01192](https://marvelcdb.com/card/01192)
* **Official Printed Text:** `When Revealed: Place 4 threat on each side scheme. If there are no side schemes in play, discard cards from the top of the encounter deck until a side scheme is discarded. Reveal that side scheme.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'PLACE_THREAT_PER_SIDE_SCHEME' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
