# [ADR-0064] Canonical Target Scopes, Form Invariants & Interactive Distribution Modal System

- **Status:** Accepted
- **Date:** 2026-09-17
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

In Marvel Champions Rules Reference (RR v1.8), targeting semantics distinguish clearly between player identities (which change between Hero and Alter-Ego forms), allies, and players as game participants. Specifically:
- RR v1.8 p. 11 ("Damage") and p. 13 ("Identity"): *"While a player is in hero form, their identity is a hero. While a player is in alter-ego form, their identity is an alter-ego. An ability that targets a hero cannot target an alter-ego, and vice versa."*
- RR v1.8 p. 14 ("Indirect Damage"): Indirect damage dealt to players must be assigned among characters they control, bounded by remaining hit points.
- RR v1.8 p. 19 ("Player") & p. 20 ("Status Cards"): Abilities targeting *"each player"* affect every participant regardless of form, while abilities targeting *"each hero"* strictly exclude Alter-Egos.

Previously, MCD had several schema and engine ambiguities:
1. Target selector naming inconsistency: `Explosion` (`01111`) used `HEROES_AND_ALLIES` without the standard `ALL_` prefix used by all other collective selectors (`ALL_HEROES`, `ALL_ENEMIES`, `ALL_CHARACTERS`).
2. Redundant concepts: Multiple potential interpretations of player vs identity targeting (`ALL_IDENTITIES` vs `ALL_PLAYERS`).
3. Leaky form gating in engine effects: `DEAL_DAMAGE` and `ADD_STATUS` when targeting `ALL_HEROES` did not strictly filter `player.currentForm === 'hero'`, allowing *Shocker* (`01103`) to deal damage to Alter-Egos and *Rhino Stage III* (`01096`) to stun Alter-Egos in multiplayer or solo games. Furthermore, `ADD_STATUS` with `ALL_HEROES` erroneously targeted only a single active player.
4. Point distribution mechanics (*Explosion*, *Wasp*, *Spider-Tracer*) lacked a first-class interactive UI modal system and dynamic capacity ceiling logic.

How do we establish canonical, orthogonal collective target scopes, enforce strict form invariants, and provide an interactive distribution system?

---

## Decision Drivers

- **Rules Precision (RR v1.8):** Strict compliance with RR v1.8 p. 11, 13, 14, 19, and 20 regarding Hero vs Alter-Ego form immunity.
- **Zero Tech Debt Invariant:** Strict, unambiguous taxonomy with no duplicate selectors (e.g. no `ALL_IDENTITIES`), consistent `ALL_` prefixes for plural scopes, and direct refactoring.
- **Multiplayer Correctness:** Collective targeting (`ALL_HEROES`, `ALL_HEROES_AND_ALLIES`) must iterate all participants across the table while respecting individual character forms.
- **Tabletop Presentation:** 1960s Comic Pop-Art modal for point allocations (damage, threat removal, healing) with capacity enforcement and shortfall resilience.

---

## Considered Options

1. **Option 1: Ad-hoc Special Cases in Card Abilities**
   - Retain disparate target selectors and handle form checks per card script or inside specific encounter plugins.
2. **Option 2: Schema Taxonomy Consolidation, Form Invariant Enforcement in Primitives, and First-Class Interactive Distribution System (Chosen)**
   - Define canonical orthogonal target scopes in `TargetSelectorSchema`.
   - Purge duplicate `ALL_IDENTITIES`; standardize on `ALL_PLAYERS` for dual-domain (player state vs character) targeting.
   - Enforce `ALL_HEROES_AND_ALLIES` with the canonical `ALL_` prefix.
   - Strictly filter `player.currentForm === 'hero'` within universal engine effect primitives (`DEAL_DAMAGE`, `ADD_STATUS`).
   - Implement `DISTRIBUTE_POINTS` modal with dynamic board capacity limits.

---

## Decision Outcome

**Chosen Option:** **Option 2: Schema Taxonomy Consolidation, Form Invariant Enforcement in Primitives, and First-Class Interactive Distribution System**

### Rationale ("The Why")

1. **Orthogonal Target Scopes:**
   Establishing a single canonical target scopes matrix eliminates guesswork and ensures every combination of affected entities has exactly one unambiguous selector:

| Target Selector | Affects Heroes? | Affects Alter-Egos? | Affects Allies? | Canonical Meaning & Card Text Equivalent |
| :--- | :---: | :---: | :---: | :--- |
| **`ALL_HEROES`** | ✅ Yes | ❌ **No** | ❌ No | Identities strictly in **Hero** form (*"each hero"*, *"heroes"*). |
| **`ALL_PLAYERS`** | ✅ Yes | ✅ **Yes** | ❌ No | Every player / identity regardless of form (*"each player"*, *"players"*). |
| **`ALL_HEROES_AND_ALLIES`** | ✅ Yes | ❌ **No** | ✅ Yes | Identities strictly in **Hero** form + all allies (*"heroes and allies"*). |
| **`ALL_FRIENDLY_CHARACTERS`** | ✅ Yes | ✅ **Yes** | ✅ Yes | All player identities (any form) + all allies (*"characters you/players control"*). |
| **`ALL_ALLIES`** | ❌ No | ❌ No | ✅ Yes | All allies in play (*"each ally"*, *"all allies"*). |
| **`ALL_ENEMIES`** | ❌ No | ❌ No | ❌ No | The villain + all minions in play (*"all enemies"*). |
| **`ALL_CHARACTERS`** | ✅ Yes | ✅ **Yes** | ✅ Yes (+ Enemies) | Every character on the board (*"all characters"*). |

2. **Form Invariant Enforcement in Universal Primitives:**
   Instead of relying on card definitions to guard against Alter-Egos, the engine primitives themselves (`DEAL_DAMAGE`, `ADD_STATUS`) enforce the invariant:
   `for (const p of state.players.filter(pl => pl.currentForm === 'hero'))`
   This cleanly immunizes Alter-Egos against *Shocker* (`01103`), *Rhino Stage III* (`01096`), and any future hero-targeted effects across the entire card catalog.

3. **Multiplayer Resolution:**
   `ADD_STATUS` for `ALL_HEROES` iterates over all players at the table, ensuring all eligible heroes receive the status (e.g. Stunned) rather than restricting application to a single active player.

4. **Zero Duplicate Invariant:**
   `ALL_IDENTITIES` is omitted. `ALL_PLAYERS` serves as the sole canonical selector for targeting every player at the table, resolving against player-state (draw/discard) or physical character identities as dictated by the effect primitive.

---

## Evaluation of Options

### Option 1: Ad-hoc Special Cases in Card Abilities
- **Pros:**
  - Minimal immediate changes.
- **Cons:**
  - Violates Zero Tech Debt Invariant.
  - Brittle; requires repeating form checks across multiple cards.
  - High risk of multiplayer desynchronization where Alter-Egos are improperly targeted.

### Option 2: Schema Taxonomy Consolidation & Form Invariant Enforcement (Chosen)
- **Pros:**
  - 100% compliant with RR v1.8 p. 11, 13, 14, 19, and 20.
  - Form invariants guaranteed by the engine, eliminating card-level vulnerabilities.
  - Naming symmetry across all collective selectors (`ALL_` prefix).
  - Clear foundation for interactive point distribution in UI.
- **Cons:**
  - Requires updating existing card declarations (`core_encounter.json` Explosion `01111`) and regenerating schemas.

---

## Consequences

### Positive Consequences
- *Shocker* (`01103`) correctly ignores players in Alter-Ego form.
- *Rhino Stage III* (`01096`) stuns all heroes in multiplayer while Alter-Egos remain immune.
- *Explosion* (`01111`) targets `ALL_HEROES_AND_ALLIES` cleanly through the canonical schema.
- Automatic propagation into the Card Supplemental Editor dropdowns via `TargetSelectorSchema.options`.

### Negative Consequences / Risks & Mitigations
- Card definitions using legacy `HEROES_AND_ALLIES` must be audited and retrofitted.
  - *Mitigation:* Automated audit via `report:declarations` and card-loader quality gates.
