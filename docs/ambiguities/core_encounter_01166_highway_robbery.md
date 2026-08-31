---
card_code: "01166"
card_name: "Highway Robbery"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "FACEDOWN_ATTACHMENT_TO_SCHEME_GAP"
date_logged: "2026-08-31T03:52"
---

# Card Ambiguity Report: Highway Robbery (`01166`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01166](https://marvelcdb.com/card/01166)
* **Official Printed Text:** `<b>When Revealed</b>: Each player places a random card from their hand facedown here.
<b>When Defeated</b>: Return each facedown card here to its owner's hand.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Engine Gap:** Attaching facedown cards from player hand to a side scheme (`UNDER_CARD` / `ATTACHED_TO_SCHEME`) and restoring them to original owners upon scheme defeat is not yet implemented in `src/engine/pipeline/`.
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Implement `ATTACH_CARDS_FACEDOWN` and `RETURN_FACEDOWN_CARDS_ON_DEFEAT` in scheme lifecycle handlers.
* Write unit test verifying that cards under *Highway Robbery* return to hands when thwarted/defeated.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
