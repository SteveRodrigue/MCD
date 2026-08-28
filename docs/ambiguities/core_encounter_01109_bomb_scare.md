---
card_code: "01109"
card_name: "Bomb Scare"
pack: "core_encounter"
confidence_reached: 85
blocker_category: "SIDE_SCHEME_WHEN_REVEALED_TRIGGER_DISPATCH"
date_logged: "2026-08-28T10:00"
---

# Card Ambiguity Report: Bomb Scare (`#01109`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01109](https://marvelcdb.com/card/01109)
* **Official Printed Text:** `When Revealed: Place an additional 1 [per_hero] threat here.
(Acceleration Icon: Place +1 threat on the main scheme at the start of the villain phase.)`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Trigger Dispatch Gap in villain-phase.ts (Tier 2/3): In step5_revealEncounterCards, revealing a SIDE_SCHEME does not trigger dynamic scaling When Revealed effects.
2. **Pessimistic Confidence Rating:** 85% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Inspect and refactor the subsystem corresponding to category: `SIDE_SCHEME_WHEN_REVEALED_TRIGGER_DISPATCH`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
