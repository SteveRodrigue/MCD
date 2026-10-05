---
card_code: "01169"
card_name: "The Vulture's Plans"
pack: "core_encounter"
confidence_reached: 70
blocker_category: "MISSING_ENGINE_PRIMITIVE"
date_logged: "2026-10-04"
---

# Card Ambiguity Report: The Vulture's Plans (`01169`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01169
* **Official Printed Text:** `"When Revealed: Discard 1 card at random from each player's hand. Place 1 threat on the main scheme for each different resource type discarded this way."`
* **Tracked in:** #219, #220

---

## Root Cause & Why Confidence Was Not Achieved (< 95%)

* Original data was a placeholder (`ADD_STATUS CONFUSED / HERO`).
* Abilities removed per the Card Integration Protocol circuit-breaker (When Revealed), so the engine never executes wrong behavior.
* **Missing engine support:**
  * Hand `DISCARD` with `mode: RANDOM` for every player returning the discarded cards (#219).
  * Per-player aggregation or iteration so the different-resource count spans all discards (#220).

---

## Proposed Schema (once unblocked)

`DISCARD` (`source: HAND`, `mode: RANDOM`, `count: 1`, `target: ALL_PLAYERS`), then `ADD_THREAT` on `MAIN_SCHEME` with `amount: { from: "DISCARDED_CARDS", discardAttribute: "DIFFERENT_RESOURCES" }`.

Cards are read literally: "your hero" is never the alter-ego (project rule), so the hero selector must be form-literal.
