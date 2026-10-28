---
card_code: "01182"
card_name: "Hydra Soldier"
pack: "core_encounter"
confidence_reached: 75
blocker_category: "MISSING_ENGINE_PRIMITIVE"
date_logged: "2026-10-28"
---

# Card Ambiguity Report: Hydra Soldier (`01182`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01182
* **Official Printed Text:** `Guard. <i>(While this minion is engaged with you, you cannot attack the villain.)</i>\n<b>When Defeated</b>: Deal the engaged player an encounter card.`

---

## 🔍 Root Cause & Why Confidence Was Not Achieved (< 95%)

* **Integrated:** The `Guard` keyword is derived upstream and supported natively.
* **Not integrated (blocker):** "When Defeated: Deal the engaged player an encounter card" requires dealing a facedown encounter card to the player's dealt encounter cards pile upon defeat.
* The engine effect primitives currently include `DRAW` (player cards) and `REVEAL_ENCOUNTER_CARD`, but do not have a generic `DEAL_FACEDOWN_ENCOUNTER_CARD` primitive for triggered non-phase dealing.

---

## 🛠️ Attempted Schema Iterations

* Iteration 1: `DRAW` with `source: "ENCOUNTER_DECK"`. Rejected: `DRAW` routes to player hand, not dealt encounter cards.
* Iteration 2: `REVEAL_ENCOUNTER_CARD`. Rejected: printed text specifies dealing (facedown), not revealing immediately.

---

## 🎯 Proposed Resolution Steps

1. Implement `DEAL_ENCOUNTER_CARD` effect primitive to append a card to `player.dealtEncounterCards`.
2. Add supplemental ability definition once primitive is registered.
