---
card_code: "01078"
card_name: "Get Behind Me!"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Get Behind Me! (`01078`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01078](https://marvelcdb.com/card/01078)
* **GitHub Issue:** [#26 - Sequence of actions...](https://github.com/SteveRodrigue/MCD/issues/26)
* **Official Printed Text:** `Hero Interrupt: When a treachery card is revealed from the encounter deck, cancel its "When Revealed" effects. The villain attacks you instead.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'CANCEL_TREACHERY_AND_FORCE_VILLAIN_ATTACK' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
