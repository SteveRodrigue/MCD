---
card_code: "01100"
card_name: "Enhanced Ivory Horn"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "ATTACHMENT_COMBAT_PIPELINE"
date_logged: "2026-08-28T10:00"
---

# Card Ambiguity Report: Enhanced Ivory Horn (`#01100`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01100](https://marvelcdb.com/card/01100)
* **Official Printed Text:** `Attach to Rhino.
Hero Action: Spend [physical] [physical] [physical] resources → discard this card`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Attachment Scheme Modifiers (Tier 3): villain-phase.ts step2 scheme calculations do not scan attachments for static +1 SCH bonuses.
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Inspect and refactor the subsystem corresponding to category: `ATTACHMENT_COMBAT_PIPELINE`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
