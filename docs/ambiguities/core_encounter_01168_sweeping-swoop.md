---
card_code: "01168"
card_name: "Sweeping Swoop"
pack: "core_encounter"
confidence_reached: 70
blocker_category: "MISSING_ENGINE_PRIMITIVE"
date_logged: "2026-10-04"
---

# Card Ambiguity Report: Sweeping Swoop (`01168`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01168
* **Official Printed Text:** `"When Revealed: Stun your hero. If Vulture is in play, this card gains surge. |  | [star] Boost: If this activation deals damage to a friendly character, stun that character."`
* **Tracked in:** #222, #221 (audit: `docs/backlog/plan_hero_target_audit.md`)

---

## Root Cause & Why Confidence Was Not Achieved (< 95%)

* Original When Revealed was a placeholder (`DEAL_DAMAGE 2 / HERO`) and the boost stunned the defending character unconditionally.
* Abilities removed per the Card Integration Protocol circuit-breaker (When Revealed and boost), so the engine never executes wrong behavior.
* **Missing engine support:**
  * Selector for the resolving player's hero, form-literal (#222): "Stun your hero".
  * Gate for "this activation deals damage to a friendly character" (#221) for the boost.

---

## Proposed Schema (once unblocked)

When Revealed: `ADD_STATUS STUNNED` on the hero selector, then `SURGE` gated by `IF_CARD_IN_PLAY` `01167` (Vulture). Boost: `ADD_STATUS STUNNED` on the damaged character, gated by the damage gate.

Cards are read literally: "your hero" is never the alter-ego (project rule), so the hero selector must be form-literal.
