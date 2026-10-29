---
card_code: "01181"
card_name: "Madame Hydra"
pack: "core_encounter"
confidence_reached: 75
blocker_category: "TIER_3_STRUCTURAL_REFACTOR"
date_logged: "2026-10-28"
---

# Card Ambiguity Report: Madame Hydra (`01181`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01181
* **Official Printed Text:** `Madame Hydra cannot take damage while the Legions of Hydra side scheme is in play.\n[star] <b>Forced Response</b>: After Madame Hydra schemes or attacks, place 2 threat on the Legions of Hydra side scheme.`

---

## 🔍 Root Cause & Why Confidence Was Not Achieved (< 95%)

* **Not integrated (blocker):** Stage-setter ability coverage verification lacks simulation drivers for minion attack/scheme post-resolution triggers incrementing ability counters on engaged minions.
* Per the Card Integration Protocol, abilities are omitted until simulation drivers support engaged minion activation response verification.

---

## 🎯 Proposed Resolution Steps

1. Add Stage-Setter scenario for minion post-activation triggers.
2. Re-enable ability definition once simulation coverage passes.
