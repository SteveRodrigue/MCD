---
card_code: "01130"
card_name: "Whirlwind"
pack: "core_encounter"
confidence_reached: 75
blocker_category: "TIER_3_STRUCTURAL_REFACTOR"
date_logged: "2026-10-28"
---

# Card Ambiguity Report: Whirlwind (`01130`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01130
* **Official Printed Text:** `[star] <b>Forced Interrupt</b>: When Whirlwind attacks you, also resolve his attack against each other hero.\n<hr />\n[star] <b>Boost</b>: Deal 1 damage to each hero.`

---

## 🔍 Root Cause & Why Confidence Was Not Achieved (< 95%)

* **Not integrated (blocker):** The Forced Interrupt requires resolving a complete enemy attack against every other hero in multiplayer during the initiation of Whirlwind's attack against the primary target hero.
* The current combat pipeline handles single-target enemy attacks and cannot recursively execute concurrent or sequential attacks across other heroes without phase pipeline recursion support.
* Per the Card Integration Protocol, no partial active abilities are declared for the card while the primary ability requires structural refactoring.

---

## 🛠️ Attempted Schema Iterations

* Iteration 1: `FORCED_INTERRUPT` triggering `ENEMY_ATTACKS` against `ALL_HEROES`. Rejected: `ENEMY_ATTACKS` targets a single player and does not fork the active combat context.
* No further iterations: resolving multi-hero attacks is a Tier 3 structural mechanic.

---

## 🎯 Proposed Resolution Steps

1. Implement combat pipeline queueing for multi-hero minion attacks.
2. Add declarative ability schema once the combat queue supports recursive attacks.
