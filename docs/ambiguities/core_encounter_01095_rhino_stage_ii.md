---
card_code: "01095"
card_name: "Rhino (Stage II)"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "STRUCTURAL_STAGE_TRANSITION_PIPELINE"
date_logged: "2026-08-28T10:00"
---

# Card Ambiguity Report: Rhino (Stage II) (`01095`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01095](https://marvelcdb.com/card/01095)
* **Official Printed Text:** `When Revealed: Search the encounter deck and discard pile for the Breakin' & Takin' side scheme and reveal it. Shuffle the encounter deck.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Multi-Stage Villain Transition State Machine (Tier 3): When Rhino Stage I reaches 0 HP, action-dispatcher.ts sets winner = "HEROES" rather than advancing to Stage II and triggering WHEN_REVEALED.
2. **Search Deck & Discard & Shuffle (Tier 2): SEARCH_AND_REVEAL_SIDE_SCHEME in src/engine/effects/index.ts currently searches the encounter deck only, missing encounterDiscard and omitting the post-search deck shuffle.
3. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Inspect and refactor the subsystem corresponding to category: `STRUCTURAL_STAGE_TRANSITION_PIPELINE`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
