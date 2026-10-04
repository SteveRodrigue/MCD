---
card_code: "01173"
card_name: "Electric Whip Attack"
pack: "core_encounter"
confidence_reached: 70
blocker_category: "MISSING_ENGINE_PRIMITIVE"
date_logged: "2026-10-04"
---

# Card Ambiguity Report: Electric Whip Attack (`01173`)

* **MarvelCDB Link:** https://marvelcdb.com/card/01173
* **Official Printed Text:** `"When Revealed: Choose to either deal 1 damage to your hero for each upgrade you control or choose and discard an upgrade you control. | [star] Boost: If the villain is making an undefended attack, choose and discard an upgrade you control."`
* **Tracked in:** #222 (form-literal "your hero" selector), WP8 / #241 (`docs/backlog/plan_effect_params_remediation.md`)

---

## Root Cause & Why Confidence Was Not Achieved (< 95%)

* The card had **no When Revealed ability at all**, an invented `CONSTANT MODIFY_STAT ATTACK +1` (removed), and a boost that discarded an upgrade **or support** on every attack (fixed: upgrades only, gated on the new `UNDEFENDED_ATTACK` condition with `attackerKind: VILLAIN`, added in WP4 / #229).
* The **boost is now modelled and tested** (`tests/engine/electric-whip-attack.test.ts`).
* The **When Revealed** choice is intentionally **not modelled**: its first option says "deal 1 damage to **your hero**", which is never the alter-ego (project rule: cards are read literally). The engine has no form-literal selector for the resolving player's hero (#222), and using `SELF_IDENTITY` would damage the alter-ego in alter-ego form, which contradicts the printed text. Shipping only the discard option would silently remove the player's choice.
* **Missing engine support:** a target selector for the resolving player's hero, form-literal (#222).

---

## Proposed Schema (once unblocked)

`WHEN_REVEALED` ability with one `PLAYER_CHOICE` step (options with their own `steps`, ADR-0075):

1. Option "damage": `DEAL_DAMAGE` with `amount: { from: ENTITY_COUNT, filter: { types: [upgrade] } }` (upgrades you control, `multiplier` 1) on the form-literal hero selector from #222.
2. Option "discard": `DISCARD` with `source: TABLEAU`, `filter: { types: [upgrade] }`, `target: DEFENDING_PLAYER` (same shape as the boost).

When #222 lands: add the ability, add tests for both options (with and without upgrades; alter-ego form must not take the damage), bump `audit.confidence`, remove `audit.ambiguityFile`, and delete this file.
