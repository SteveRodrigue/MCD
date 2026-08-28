---
card_code: "01050"
card_name: "Hulk (Bruce Banner)"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Hulk (Bruce Banner) (`01050`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01050](https://marvelcdb.com/card/01050)
* **Official Printed Text:** `Forced Response: After Hulk attacks, discard the top card of your deck. If that card's printed resource has:
[physical] - Deal 2 damage to an enemy.
[energy] - Deal 1 damage to each character.
[mental] - Discard Hulk.
[wild] - All of the above.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'HULK_DISCARD_RESOLUTION' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
