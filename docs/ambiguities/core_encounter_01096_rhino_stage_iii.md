---
card_code: "01096"
card_name: "Rhino (Stage III)"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "STRUCTURAL_STAGE_TRANSITION_PIPELINE"
date_logged: "2026-08-28T09:26"
---

# Card Ambiguity Report: Rhino Stage III (`#01096`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01096](https://marvelcdb.com/card/01096)
* **Official Printed Text:** `Toughness. <i>(This character enter play with a tough status card.)</i>
<b>When Revealed</b>: Stun each hero.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Multi-Stage Villain Transition State Machine (Tier 3):** When Rhino Stage II reaches 0 HP, `action-dispatcher.ts` sets `winner = 'HEROES'` rather than advancing to Stage III and triggering `WHEN_REVEALED` (Stun all heroes + Tough).
2. **Current Confidence:** 80% (Tier 3 Gate Fired).
