---
card_code: "01061"
card_name: "Great Responsibility"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T10:10"
---

# Card Ambiguity Report: Great Responsibility (`01061`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01061](https://marvelcdb.com/card/01061)
* **Official Printed Text:** `Hero Interrupt: When any amount of threat would be placed on a scheme, you take it as damage instead.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Threat replacement with hero damage prompt modal not implemented.**
2. **Effect primitive 'CONVERT_THREAT_TO_DAMAGE' is not implemented in src/engine/effects/index.ts.**
3. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Implement missing TypeScript effect primitive or pipeline trigger dispatch in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
