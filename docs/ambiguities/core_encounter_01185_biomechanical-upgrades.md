---
card_code: "01185"
card_name: "Biomechanical Upgrades"
pack: "core_encounter"
confidence_reached: 75
blocker_category: "TIER_3_STRUCTURAL_REFACTOR"
date_logged: "2026-10-28"
---

# Card Ambiguity Report: Biomechanical Upgrades (`01185`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01185
* **Official Printed Text:** `Surge.\nAttach to the minion with the highest printed hit points and without another Biomechanical Upgrades attached.\n<b>Forced Interrupt</b>: When attached minion would be defeated, heal all damage from it instead, then discard this card.`

---

## 🔍 Root Cause & Why Confidence Was Not Achieved (< 95%)

* **Not integrated (blocker):**
  1. Attachment targeting rule: "Attach to the minion with the highest printed hit points and without another Biomechanical Upgrades attached" requires dynamic minion ranking and attachment uniqueness checking during attachment resolution.
  2. Defeat cancellation interrupt: "When attached minion would be defeated, heal all damage from it instead, then discard this card" requires a defeat cancellation / substitution interrupt window in the character defeat pipeline.
* Per Card Integration Protocol, abilities are omitted until defeat substitution is implemented in the engine.

---

## 🛠️ Attempted Schema Iterations

* Iteration 1: `FORCED_INTERRUPT` on `DEFEATED` with `HEAL_DAMAGE` and `DISCARD`. Rejected: `DEFEATED` triggers after character defeat has processed, not as a replacement/prevention.

---

## 🎯 Proposed Resolution Steps

1. Add attachment target evaluator for `MINION_WITH_HIGHEST_PRINTED_HP_WITHOUT_SAME_ATTACHMENT`.
2. Add `WOULD_BE_DEFEATED` interrupt trigger and defeat cancellation support.
