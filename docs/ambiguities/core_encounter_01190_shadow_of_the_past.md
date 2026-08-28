---
card_code: "01190"
card_name: "Shadow of the Past"
pack: "core_encounter"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Shadow of the Past (`01190`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01190](https://marvelcdb.com/card/01190)
* **Official Printed Text:** `When Revealed: Reveal your set-aside nemesis minion and put it into play engaged with you. Reveal your set-aside nemesis side scheme and put it into play. Shuffle the rest of your set-aside nemesis encounter set into the encounter deck. If your nemesis minion does not enter the game this way, this card gains surge.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Nemesis Set Search & Spawn Pipeline (Tier 3): Shadow of the Past searching SET_ASIDE_NEMESIS and spawning nemesis minion/scheme is not implemented.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core_encounter.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
