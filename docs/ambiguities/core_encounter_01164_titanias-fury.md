---
card_code: "01164"
card_name: "Titania's Fury"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "MISSING_ENGINE_PRIMITIVE"
date_logged: "2026-10-04"
---

# Card Ambiguity Report: Titania's Fury (`01164`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01164
* **Official Printed Text:** `"When Revealed: Titania attacks your hero. If Titania did not attack, heal all damage from Titania and this card gains surge. |  | [star] Boost: Give the villain 1 additional boost card for this activation."`
* **Tracked in:** #223 (the hero selector of #222 is done: `SELF_HERO`)

---

## Root Cause & Why Confidence Was Not Achieved (< 95%)

* Original When Revealed was a placeholder (`DEAL_DAMAGE 2 / HERO`). The boost ability (`GIVE_ADDITIONAL_BOOST_CARD`) is correct and kept.
* Abilities removed per the Card Integration Protocol circuit-breaker (When Revealed only; the correct boost ability stays), so the engine never executes wrong behavior.
* **Missing engine support:**
  * Named-minion attack primitive with an attacked/did-not-attack result (#223).
  * ~~Selector for the resolving player's hero, form-literal~~ (#222, done: `SELF_HERO`).

---

## Proposed Schema (once unblocked)

Step 1: minion `01162` (Titania, in play) attacks the resolving player's hero. Step 2 (gate on `did not attack`): heal all damage from Titania, then `SURGE`.

Cards are read literally: "your hero" is never the alter-ego (project rule), so the hero selector must be form-literal.
