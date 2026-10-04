---
card_code: "01159"
card_name: "Ritual Combat"
pack: "core_encounter"
confidence_reached: 70
blocker_category: "MISSING_ENGINE_PRIMITIVE"
date_logged: "2026-10-04"
---

# Card Ambiguity Report: Ritual Combat (`01159`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01159
* **Official Printed Text:** `"When Revealed: Discard the top card of the encounter deck. Then, choose to either deal X damage to your hero or place X threat on the main scheme. X is 1 more than the number of boost icons on the discarded encounter card."`
* **Tracked in:** #222, #218 (audit: `docs/backlog/plan_hero_target_audit.md`)

---

## Root Cause & Why Confidence Was Not Achieved (< 95%)

* Original data was a placeholder (`DEAL_DAMAGE 2 / HERO`, no choice, fixed amount).
* Abilities removed per the Card Integration Protocol circuit-breaker (When Revealed), so the engine never executes wrong behavior.
* **Missing engine support:**
  * Selector for the resolving player's hero, form-literal (#222): `HERO` damages every hero-form player.
  * Confirm that `PLAYER_CHOICE` option amounts can read the discarded encounter card's boost icons (`DISCARDED_CARDS` / `BOOST_ICONS`) when the prompt resolves after the discard step.

---

## Proposed Schema (once unblocked)

`DISCARD` (`source: ENCOUNTER_DECK`, `mode: TOP`, `count: 1`), then `PLAYER_CHOICE` with `DEAL_DAMAGE` on the hero selector and `ADD_THREAT` on `MAIN_SCHEME`, both `amount: 1` plus `dynamicBonus: { from: "DISCARDED_CARDS", discardAttribute: "BOOST_ICONS" }`.

Cards are read literally: "your hero" is never the alter-ego (project rule), so the hero selector must be form-literal.
