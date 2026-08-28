---
card_code: "01096"
card_name: "Rhino (Stage III)"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "STRUCTURAL_STAGE_TRANSITION_PIPELINE"
date_logged: "2026-08-28T10:00"
---

# Card Ambiguity Report: Rhino (Stage III) (`01096`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01096](https://marvelcdb.com/card/01096)
* **Official Printed Text:** `Toughness. (This character enter play with a tough status card.)
When Revealed: Stun each hero.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Multi-Stage Villain Transition State Machine (Tier 3): When Rhino Stage II reaches 0 HP, action-dispatcher.ts sets winner = "HEROES" rather than advancing to Stage III, applying Tough, and triggering WHEN_REVEALED.
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Inspect and refactor the subsystem corresponding to category: `STRUCTURAL_STAGE_TRANSITION_PIPELINE`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
