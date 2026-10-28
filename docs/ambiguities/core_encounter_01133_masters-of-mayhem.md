---
card_code: "01133"
card_name: "Masters of Mayhem"
pack: "core_encounter"
confidence_reached: 75
blocker_category: "TIER_3_STRUCTURAL_REFACTOR"
date_logged: "2026-10-28"
---

# Card Ambiguity Report: Masters of Mayhem (`01133`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01133
* **Official Printed Text:** `<b>When Revealed</b>: Each [[Masters of Evil]] minion attacks the hero it is engaged with. If no attacks were made this way, search the encounter deck and discard pile for a [[Masters of Evil]] minion and put it into play engaged with you, then shuffle the encounter deck.`

---

## 🔍 Root Cause & Why Confidence Was Not Achieved (< 95%)

* **Not integrated (blocker):** "Each Masters of Evil minion attacks the hero it is engaged with" requires initiating sequential minion attacks across multiple engaged heroes and tracking whether at least one attack successfully resolved to conditionally trigger the fallback search.
* While `VILLAIN_AND_ENGAGED_MINIONS_ATTACK` exists for a single player's minions, trait-filtered global minion activation with conditional fallback is not yet generalized.
* Per Card Integration Protocol, abilities are omitted until multi-enemy trait activation is generalized.

---

## 🛠️ Attempted Schema Iterations

* Iteration 1: `VILLAIN_AND_ENGAGED_MINIONS_ATTACK` with trait filter and `gate: "IF_RESULT"`. Rejected: does not support trait filtering or multi-player simultaneous engagement triggers.

---

## 🎯 Proposed Resolution Steps

1. Generalize `ENEMY_ATTACKS` to support `ALL_MATCHING_ENEMIES` with trait filter.
2. Provide activation count result fact for gating fallback search.
