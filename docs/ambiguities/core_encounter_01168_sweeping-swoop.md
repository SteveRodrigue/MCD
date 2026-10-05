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
* **Tracked in:** #221 (When Revealed integrated with #222)

---

## Root Cause & Why Confidence Was Not Achieved (< 95%)

* **When Revealed is integrated** (#222): `ADD_STATUS STUNNED` on `SELF_HERO`, then `SURGE` gated `IF_CARD_IN_PLAY` Vulture (`01167`). Tested in `tests/engine/self-hero-cards.test.ts`.
* **Only the boost is still stripped** (circuit-breaker): "If this activation deals damage to a friendly character, stun that character."
* **Missing engine support:** a gate for "this activation deals damage to a friendly character" (#221), exposing who was damaged to the boost's `ADD_STATUS`.

---

## Proposed Schema (once unblocked)

Boost: `ADD_STATUS STUNNED` on the damaged character, gated by the damage gate of #221. When #221 lands: add the boost, bump `audit.confidence`, remove `audit.ambiguityFile`, delete this file.
