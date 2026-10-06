---
card_code: "01163"
card_name: "Genetically Enhanced"
pack: "core_encounter"
confidence_reached: 70
blocker_category: "MISSING_ENGINE_PRIMITIVE"
date_logged: "2026-10-06"
---

# Card Ambiguity Report: Genetically Enhanced (`01163`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01163
* **Official Printed Text:** `"Attach to the minion with the highest printed hit points. If there are no minions in play, this card gains surge. Attached minion gets +3 hit points."`
* **Tracked in:** #228, #209

---

## Root Cause & Why Confidence Was Not Achieved (< 95%)

* Original data was a placeholder (`CONSTANT` `ADD_STATUS` with an unread `bonusAttack: 1`). "+1 attack" appears nowhere on the card.
* Abilities removed per the Card Integration Protocol circuit-breaker, so the engine never executes wrong behavior.
* **Missing engine support:**
  * Conditional attach target ("Attach to X. Otherwise ..."), here "the minion with the highest printed hit points", with a no-minion fallback to surge (#209).
  * A hit point modifier on the attached minion (+3 HP while attached).
  * Tie-break when several minions share the highest printed hit points.

---

## Owner Decision (2026-10-06)

When minions tie for the highest printed hit points, the first player is prompted to choose among the tied minions.

---

## Proposed Schema (once unblocked)

Attach target selector `MINION_HIGHEST_PRINTED_HP` (ties: first player chooses), `SURGE` when no minion is in play, and a `CONSTANT` hit point modifier of +3 on the attached minion.

## Tests to write once unblocked

Attaches to the minion with the highest printed HP; tie prompts the first player; no minions in play gives surge; attached minion has +3 HP; removing the attachment restores the HP.
