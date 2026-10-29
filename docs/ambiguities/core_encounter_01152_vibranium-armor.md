---
card_code: "01152"
card_name: "Vibranium Armor"
pack: "core_encounter"
confidence_reached: 75
blocker_category: "TIER_3_STRUCTURAL_REFACTOR"
date_logged: "2026-10-28"
---

# Card Ambiguity Report: Vibranium Armor (`01152`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01152
* **Official Printed Text:** `Attach to the villain.\n<b>Forced Response</b>: After the villain take damage, give it a tough status card.\n<b>Hero Action</b>: Exhaust your hero and spend [physical] [physical] resources → discard this card.`

---

## 🔍 Root Cause & Why Confidence Was Not Achieved (< 95%)

* **Not integrated (blocker):** Stage-setter ability coverage verification lacks a scenario generator for trigger `DAMAGE_TAKEN` on attachments attached to the villain.
* Under the Gate 1.4 ability verification gauntlet, all active abilities declared on Core cards require simulation drivers.
* Per the Card Integration Protocol, abilities are omitted until simulation drivers support attachment `DAMAGE_TAKEN` triggers.

---

## 🎯 Proposed Resolution Steps

1. Add Stage-Setter scenario for attachment `DAMAGE_TAKEN` triggers.
2. Re-enable ability definition once simulation coverage passes.
