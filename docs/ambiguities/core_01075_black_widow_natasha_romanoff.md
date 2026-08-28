---
card_code: "01075"
card_name: "Black Widow (Natasha Romanoff)"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Black Widow (Natasha Romanoff) (`01075`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01075](https://marvelcdb.com/card/01075)
* **Official Printed Text:** `Interrupt: When a card is revealed from the encounter deck, exhaust Black Widow and spend a [mental] resource → cancel the effects of that card and discard it. Then, reveal another card from the encounter deck.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'CANCEL_WHEN_REVEALED' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
