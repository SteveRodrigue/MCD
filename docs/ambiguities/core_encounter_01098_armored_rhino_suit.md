---
card_code: "01098"
card_name: "Armored Rhino Suit"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "ATTACHMENT_COMBAT_PIPELINE"
date_logged: "2026-08-28T10:00"
---

# Card Ambiguity Report: Armored Rhino Suit (`01098`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01098](https://marvelcdb.com/card/01098)
* **Official Printed Text:** `Attach to Rhino.
Forced Interrupt: When any amount of damage would be dealt to Rhino, place it here instead. Then, if there is at least 5 damage here, discard Armored Rhino Suit.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Attachment Damage Absorption Pipeline (Tier 3): Attachment cards are pushed to state.villain.attachments, but the damage pipeline (damage-pipeline.ts / player-actions.ts) does not inspect attachments for damage prevention/armor, nor does it support removing counters from attachments.
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Inspect and refactor the subsystem corresponding to category: `ATTACHMENT_COMBAT_PIPELINE`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
