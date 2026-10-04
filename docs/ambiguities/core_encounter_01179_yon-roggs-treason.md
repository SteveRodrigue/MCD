---
card_code: "01179"
card_name: "Yon-Rogg's Treason"
pack: "core_encounter"
confidence_reached: 70
blocker_category: "MISSING_ENGINE_PRIMITIVE"
date_logged: "2026-10-04"
---

# Card Ambiguity Report: Yon-Rogg's Treason (`01179`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01179
* **Official Printed Text:** `"When Revealed: Discard each [energy] resource from your hand. If you discarded no cards this way, this card gains surge."`
* **Tracked in:** #219, #218 (audit: `docs/backlog/plan_hero_target_audit.md`)

---

## Root Cause & Why Confidence Was Not Achieved (< 95%)

* Original data was a placeholder (`DEAL_DAMAGE 2 / HERO`).
* Abilities removed per the Card Integration Protocol circuit-breaker (When Revealed), so the engine never executes wrong behavior.
* **Missing engine support:**
  * Hand `DISCARD` that applies `filter` (printed energy resource) and `count: ALL`, and returns the discarded cards (#219).
  * `SURGE` gated by `IF_AMOUNT_ZERO` on that result (the `Surge` effect exists).

---

## Proposed Schema (once unblocked)

`DISCARD` (`source: HAND`, `count: ALL`, `target: SELF_IDENTITY`, `filter` printed energy resource), then `SURGE` with `gate: IF_AMOUNT_ZERO`.

Cards are read literally: "your hero" is never the alter-ego (project rule), so the hero selector must be form-literal.
