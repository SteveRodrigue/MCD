---
card_code: "01017"
card_name: "Cosmic Flight"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T12:46"
---

# Card Ambiguity Report: Cosmic Flight (`01017`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01017](https://marvelcdb.com/card/01017)
* **Official Printed Text:** `Captain Marvel gains the [[Aerial]] trait.
Hero Interrupt (defense): When Captain Marvel would take damage, discard Cosmic Flight → prevent 3 of that damage.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'ADD_TRAIT' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Active Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Refactor corresponding subsystem in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
