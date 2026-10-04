---
card_code: "01174"
card_name: "Electromagnetic Backlash"
pack: "core_encounter"
confidence_reached: 70
blocker_category: "MISSING_ENGINE_PRIMITIVE"
date_logged: "2026-10-04"
---

# Card Ambiguity Report: Electromagnetic Backlash (`01174`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01174
* **Official Printed Text:** `"When Revealed: Each player discards the top 5 cards of their deck. For each printed [energy] resource a player discards this way, that player takes 1 damage."`
* **Tracked in:** #220, #219 (audit: `docs/backlog/plan_hero_target_audit.md`)

---

## Root Cause & Why Confidence Was Not Achieved (< 95%)

* Original data was a placeholder (`DEAL_DAMAGE 2 / HERO`).
* Abilities removed per the Card Integration Protocol circuit-breaker (When Revealed), so the engine never executes wrong behavior.
* **Missing engine support:**
  * Per-player iteration inside one ability (#220): each player's damage depends on their own discard.
  * Hand/deck `DISCARD` returning the discarded cards for each player (#219).

---

## Proposed Schema (once unblocked)

For each player: `DISCARD` (`source: DECK`, `mode: TOP`, `count: 5`), then `DEAL_DAMAGE` to that player with `amount: { from: "DISCARDED_CARDS", discardAttribute: "RESOURCE_ICONS", resourceType: "energy" }`.

Cards are read literally: "your hero" is never the alter-ego (project rule), so the hero selector must be form-literal.
