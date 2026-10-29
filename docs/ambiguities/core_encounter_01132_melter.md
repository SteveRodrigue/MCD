---
card_code: "01132"
card_name: "Melter"
pack: "core_encounter"
confidence_reached: 75
blocker_category: "TIER_3_STRUCTURAL_REFACTOR"
date_logged: "2026-10-28"
---

# Card Ambiguity Report: Melter (`01132`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01132
* **Official Printed Text:** `[star] The engaged player must defend against Melter's attacks with an ally they control, if able.\n<hr />\n[star] <b>Boost</b>: Exhaust each ally you control.`

---

## 🔍 Root Cause & Why Confidence Was Not Achieved (< 95%)

* **Not integrated (blocker):** The passive ability forces the defending player to choose an ally defender option during Melter's attack, forbidding hero defense or undefended attack if the player controls a ready ally.
* This requires defender legality constraints in `combat-pipeline.ts` to restrict the available defender choices generated in `buildDefenderPrompt`.
* Per the Card Integration Protocol, abilities are omitted until defender constraint modifiers are implemented.

---

## 🛠️ Attempted Schema Iterations

* Iteration 1: `CONSTANT` effect with `DECLARE_DEFENDER` restriction. Rejected: no generic defender constraint modifier currently exists in the legality/combat pipeline.
* No further iterations: defender restriction constraint is Tier 3.

---

## 🎯 Proposed Resolution Steps

1. Add defender candidate filter predicate in `buildDefenderPrompt` inspecting attacker rules text.
2. Implement defender constraint modifier in `src/engine/pipeline/combat-pipeline.ts`.
