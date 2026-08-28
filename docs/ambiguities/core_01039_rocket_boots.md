---
card_code: "01039"
card_name: "Rocket Boots"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Rocket Boots (`01039`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01039](https://marvelcdb.com/card/01039)
* **Official Printed Text:** `You get +1 hit point.
Hero Action: Exhaust Rocket Boots and spend a [mental] resource → gain the [[Aerial]] trait until the end of the phase.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'HP_BONUS' is not implemented in src/engine/effects/index.ts.**
2. **Effect primitive 'GRANT_TEMPORARY_TRAIT' is not implemented in src/engine/effects/index.ts.**
3. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
