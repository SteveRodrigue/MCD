---
card_code: "01099"
card_name: "Charge"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "ATTACHMENT_COMBAT_PIPELINE"
date_logged: "2026-08-28T10:00"
---

# Card Ambiguity Report: Charge (`#01099`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01099](https://marvelcdb.com/card/01099)
* **Official Printed Text:** `Attach to Rhino.
[star] Forced Interrupt: When Rhino attacks, the attack gains overkill. (Excess damage to an ally from this attack is dealt to that ally's controller.) At the end of this attack, discard Charge.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Attachment Stat Modifiers & Keywords (Tier 3): villain-phase.ts step2 activations and combat resolution do not calculate +3 ATK from Charge, nor is the Overkill keyword handled on villain activations.
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Inspect and refactor the subsystem corresponding to category: `ATTACHMENT_COMBAT_PIPELINE`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
