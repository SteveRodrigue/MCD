---
card_code: "01100"
card_name: "Enhanced Ivory Horn"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Enhanced Ivory Horn (`01100`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01100](https://marvelcdb.com/card/01100)
* **Official Printed Text:** `Attach to Rhino.
Hero Action: Spend [physical] [physical] [physical] resources → discard this card`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Attachment Stat Modifiers (Tier 3): Attachments in state.villain.attachments are not scanned for +3 ATK, Overkill, or +1 SCH during activations.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
