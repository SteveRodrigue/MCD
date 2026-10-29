---
card_code: "01131"
card_name: "Tiger Shark"
pack: "core_encounter"
confidence_reached: 75
blocker_category: "TIER_3_STRUCTURAL_REFACTOR"
date_logged: "2026-10-28"
---

# Card Ambiguity Report: Tiger Shark (`01131`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01131
* **Official Printed Text:** `[star] <b>Forced Response</b>: After Tiger Shark attacks, give him a tough status card.\n<hr />\n[star] <b>Boost</b>: Give the villain a tough status card.`

---

## 🔍 Root Cause & Why Confidence Was Not Achieved (< 95%)

* **Not integrated (blocker):** Stage-setter ability coverage verification requires an unconditioned status card transition on `MINION_ATTACKED` when the minion is not already tough.
* Under the Gate 1.4 ability verification gauntlet, minion post-attack self-buffing requires dedicated stage-setter scenario scaffolding.
* Per the Card Integration Protocol, abilities are omitted until simulation drivers support enemy self-status post-attack triggers.

---

## 🎯 Proposed Resolution Steps

1. Add Stage-Setter scenario for enemy self-status triggers on attack.
2. Re-enable ability definition once simulation coverage passes.
