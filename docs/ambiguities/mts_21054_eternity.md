---
card_code: "21054"
card_name: "Eternity"
pack: "mts"
confidence_reached: 50
blocker_category: "MISSING_ENGINE_PRIMITIVE"
date_logged: "2026-10-07"
---

# Card Ambiguity Report: Eternity (`#21054`)

* **MarvelCDB Link:** https://marvelcdb.com/card/21054
* **Official Printed Text:** `"Action: Shuffle this card into the encounter deck (without looking). When Revealed: Draw 1 card and remove this card from the game. This effect cannot be canceled."`

---

## 🔍 Root Cause & Why Confidence Was Not Achieved (< 95%)

* **Integrated (proof card for Issue #255):** the *When Revealed* ability is declared with `DRAW` 1 and `REMOVE_FROM_GAME`, both flagged `cannotBeCanceled` ("This effect cannot be canceled"). Eternity is the single card used to prove the step-level flag; the choke point is `canCancelEncounterReveal` (`src/engine/pipeline/encounter-cancel.ts`).
* **Not integrated (blocker):** the **Action** needs a primitive that shuffles a card from the table into the encounter deck without looking (no `SHUFFLE_INTO_ENCOUNTER_DECK` effect exists), and the Mutant Genesis scenario setup is not implemented. Until then the card cannot be played from hand, so it never reaches the encounter deck in a real game; the reveal ability is exercised by tests only.

---

## 🎯 Proposed Resolution Steps

1. Add a generic effect that shuffles the source card into the encounter deck (no peeking) and declare the *Action* ability (type `event`, so it is played from hand and returns to the deck instead of the discard pile).
2. Raise confidence and delete this file.
3. The sibling Mutant Genesis cards `21042`, `21048`, `21060` have the same shape (`cannotBeCanceled` effects) and can be added at the same time.
