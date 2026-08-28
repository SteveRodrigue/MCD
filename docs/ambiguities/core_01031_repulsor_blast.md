---
card_code: "01031"
card_name: "Repulsor Blast"
pack: "core"
confidence_reached: 80
blocker_category: "PESSIMISTIC_CODE_AUDIT_GAP"
date_logged: "2026-08-28T10:10"
---

# Card Ambiguity Report: Repulsor Blast (`01031`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01031](https://marvelcdb.com/card/01031)
* **Official Printed Text:** `Hero Action (attack): Deal 1 damage to an enemy and discard the top 5 cards of your deck. For each printed [energy] resource discarded this way, deal 2 additional damage to that enemy.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
1. **Effect primitive 'REPULSOR_BLAST_DAMAGE' is not implemented in src/engine/effects/index.ts.**
2. **Pessimistic Confidence Rating:** 80% (Circuit-Breaker Fired / Abilities Stripped).

---

## 🛠️ Required Architectural Implementation Plan
* Implement missing TypeScript effect primitive or pipeline trigger dispatch in `src/engine/`.
* Write regression unit test verifying end-to-end trigger dispatch and resolution.
* Restore `abilities: [...]` in `src/data/supplemental/pack/core.json`, elevate confidence to >= 95%, and delete this report (Inbox Zero).
