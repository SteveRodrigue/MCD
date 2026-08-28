---
card_code: "01110"
card_name: "Hydra Bomber"
pack: "core_encounter"
confidence_reached: 85
blocker_category: "MINION_WHEN_REVEALED_TRIGGER_DISPATCH"
date_logged: "2026-08-28T10:00"
---

# Card Ambiguity Report: Hydra Bomber (`01110`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01110](https://marvelcdb.com/card/01110)
* **Official Printed Text:** `When Revealed: Choose to either take 2 damage or place 1 threat on the main scheme.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Trigger Dispatch Gap in villain-phase.ts (Tier 2/3): In step5_revealEncounterCards, revealing Hydra Bomber does not execute its WHEN_REVEALED ability to deal 1 damage to each hero.
2. **Pessimistic Confidence Rating:** 85% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Inspect and refactor the subsystem corresponding to category: `MINION_WHEN_REVEALED_TRIGGER_DISPATCH`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
