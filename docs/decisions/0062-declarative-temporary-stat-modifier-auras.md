# [ADR-0062] Declarative Temporary Stat Modifier Auras

- **Status:** Accepted
- **Date:** 2026-09-16
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

Marvel Champions cards such as **Vision** (`01068`) and **Lead from the Front** (`01070`) grant temporary stat buffs to characters (allies or heroes) that last for a defined duration — typically until the end of the current phase or round. Prior to this ADR, Vision's density manipulation ability was implemented as an ad-hoc card-specific hack inside `src/engine/effects/index.ts` that mutated a non-canonical `tokens.atkBonus` / `tokens.thwBonus` field. These fields were:

1. **Not tracked with a duration** — no automatic expiry pipeline existed.
2. **Silently doubled by `getEffectiveAllyStats`** — which summed both legacy token fields AND a new `activeStatModifiers` array simultaneously.
3. **Not generalizable** — every new buff card would require its own bespoke engine branch.

The engine also lacked a universal mechanism for aura-style stat modifications that expire at the end of a phase or round, which is required by RR v1.8 for a large class of ally and hero boost effects.

---

## Decision Drivers

- **Driver 1: RR v1.8 Rules Compliance** — Temporary buffs must respect explicit phase-end and round-end expiry windows per the Rules Reference.
- **Driver 2: Declarative Data-First Invariant** — All card-specific logic must live exclusively in `src/data/supplemental/pack/*.json`. The engine must only contain universal primitives.
- **Driver 3: Zero Tech Debt** — The old `tokens.atkBonus` / `tokens.thwBonus` approach must be fully purged; no dual-path aggregation.
- **Driver 4: Composability** — The solution must generalize to future buff cards (`ALL_FRIENDLY_CHARACTERS`, `SELF`, `CHOSEN_ALLY`) without new engine branches.

---

## Considered Options

1. **Option 1:** Typed `ActiveStatModifier[]` on `CardInstance` and `PlayerState`, expiring via phase/round pipeline hooks *(chosen)*
2. **Option 2:** Extend the existing `tokens` bag with expiry timestamps
3. **Option 3:** Encode buffs as temporary in-play attachment cards

---

## Decision Outcome

**Chosen Option:** **Option 1: Typed `ActiveStatModifier[]` with phase/round pipeline expiry**

### Rationale ("The Why")

Option 1 is the only approach that satisfies all four decision drivers simultaneously:

- It is fully typed in `state.ts` with an explicit `duration: 'PHASE' | 'ROUND'` discriminant that maps directly to RR v1.8 timing language.
- It places zero card-specific logic in the engine — `MODIFY_STAT` is a universal primitive that reads `target`, `stat`, `amount`, and `duration` from the supplemental JSON.
- The expiry hooks in `player-phase.ts`, `villain-phase.ts`, and `round-upkeep.ts` filter out expired modifiers at the canonical timing boundaries.
- `getEffectiveAllyStats` and `getEffectiveHeroStats` aggregate `activeStatModifiers` cleanly, with the legacy `tokens.atkBonus`/`thwBonus` accumulation fully removed.

---

## Evaluation of Options

### Option 1: Typed ActiveStatModifier[] with pipeline expiry
- **Pros:**
  - Fully declarative — new buff cards require only JSON changes.
  - Explicit `duration` field maps to RR v1.8 phase/round boundaries.
  - Modifiers on both `CardInstance` (ally-specific) and `PlayerState` (hero-wide auras) support both single-target and `ALL_FRIENDLY_CHARACTERS` targeting.
  - Automatic expiry via existing phase transition pipelines requires no UI changes.
- **Cons:**
  - Requires migration of `tokens.atkBonus` / `tokens.thwBonus` hack (zero-debt removal is the correct outcome).

### Option 2: Extend tokens bag with expiry timestamps
- **Pros:**
  - Minimal schema change.
- **Cons:**
  - `tokens` is semantically for counters (damage, threat, counters), not auras.
  - No expiry infrastructure — would require ad-hoc checks everywhere.
  - Violates the Declarative Data-First Invariant.

### Option 3: Temporary in-play attachment cards
- **Pros:**
  - Visually representable on the board.
- **Cons:**
  - Massive over-engineering for a phase-duration buff.
  - Requires a full card lifecycle for a transient modifier.
  - Violates the Zero Tech Debt principle.

---

## Consequences

### Positive Consequences

- **Vision (01068)** is now 100% declaratively modeled: `PLAYER_CHOICE` presenting two `MODIFY_STAT` options with `duration: "PHASE"` and `target: "SELF"`.
- **Lead from the Front (01070)** and any future `ALL_FRIENDLY_CHARACTERS` buff card is supported with zero new engine code.
- `getEffectiveAllyStats` and `getEffectiveHeroStats` are cleaner — single aggregation path, no dual-sum bug.
- `ONCE_PER_ROUND` ability limits on Vision are enforced via the universal `usedAbilitiesThisRound` tracking in `action-dispatcher.ts` and `canInitiateAbility` in `legality-checker.ts`.
- 6 new acceptance tests in `tests/engine/temporary-stat-modifiers.test.ts` document and lock the behavior.
- Card Editor (`effect-parameter-registry.ts`) is updated so `MODIFY_STAT` exposes `duration` with `PHASE`/`ROUND` options and `PLAYER_CHOICE` exposes `title`, `description`, `options`, and `isVoluntary`.
- Ally stat bonuses render visually in `HeroZone.tsx` and `AllyActionModal.tsx` matching the existing hero stat bonus display convention.

### Negative Consequences / Risks & Mitigations

- **Risk:** The `stat` field union must stay in sync between `ActiveStatModifier` in `state.ts` and the aggregation in `getEffectiveAllyStats`/`getEffectiveHeroStats`.
  - **Mitigation:** TypeScript narrowing raises compile errors immediately on mismatch; the union includes all canonical aliases.
- **Risk:** Multiple simultaneous aura sources could double-count.
  - **Mitigation:** Each activation pushes a separate entry; summation is correct by construction. Per RR v1.8, effects from the same card played twice stack independently.
