---
card_code: "56128b"
card_name: "Now It's Personal"
pack: "cw_encounter"
confidence_reached: 50
blocker_category: "MISSING_ENGINE_PRIMITIVE"
date_logged: "2026-10-03"
---

# Card Ambiguity Report: Now It's Personal (`#56128b`)

* **MarvelCDB Link:** https://marvelcdb.com/card/56128b
* **Official Printed Text:** `"Give to the first player. Action: Remove this card from the game → each player on your team chooses 2 of your leader's set-aside player cards and adds them to their hand."`

---

## 🔍 Root Cause & Why Confidence Was Not Achieved (< 95%)

* **Integrated (proof card for Issue #158):** the *Give to the first player* line is declared as the top-level `recipient: { "type": "FIRST_PLAYER" }` override. It is the only real derogation of the obligation default among the 106 audited obligations, and `56128b` is deliberately the single card used to prove the override (its sibling `56206b` is left out).
* **Not integrated (blocker):** the **Action** ability needs Civil War (PvP) concepts that do not exist in the engine: teams, a *leader*, and the leader's *set-aside player cards*. Per the Card Integration Protocol, no partial `abilities` array is declared for the card, so the engine never executes an unsupported ability.
* The card is a double-sided print of *Choosing Sides* (`56128a`, a side scheme), so it only appears as an obligation after that side scheme flips; the PvP scenario is not implemented either.

---

## 🛠️ Attempted Schema Iterations

* Iteration 1: `ACTION` ability with `cost.removeFromGame` and a `PUT_INTO_HAND` step per team member. Rejected: no team or leader selector, no set-aside leader card zone.
* No further iterations: the missing concepts are structural (Tier 3), not parameter gaps.

---

## 🎯 Proposed Resolution Steps

1. Model teams and the leader in `GameState` (Civil War scenario plugin) and add selectors for "each player on your team" and "your leader's set-aside cards".
2. Reuse the generic `REMOVE_FROM_GAME` primitive added for Issue #158 as the ability cost.
3. Add the `ACTION` ability to `src/data/supplemental/pack/cw_encounter.json` (keep `recipient`), raise confidence, and delete this file.
4. Related data note: the sibling print `56206b` carries identical text and the same `recipient` need; add it at the same time.
